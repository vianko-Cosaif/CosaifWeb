import type {
    DashboardBannerConfig,
    BannerState,
    BannerElementConfig,
    BannerLayer,
    BannerLayerType,
    BannerMeta,
} from "./DynamicBanner.types";
import { webStorage } from "./DynamicBanner.storage";

const DEFAULT_DESIGN_WIDTH = 800;
const DEFAULT_DESIGN_HEIGHT = 220;
const BANNER_CACHE_KEY = "dynamicBanner.cache.config.v1";
const BANNER_META_KEY = "dynamicBanner.cache.meta.v1";

const parsePositiveNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePxValue = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized.endsWith("px")) return null;
    const parsed = Number(normalized.replace("px", "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const inferLayerTypeFromLegacyElement = (element: BannerElementConfig): BannerLayerType => {
    const tag = String(element.tag || "").toLowerCase();
    if (tag === "img" || !!element.src) return "image";
    if (tag === "canvas") return "canvas";
    if (tag === "lottie") return "lottie";
    if (element.content || element.value) return element.animation?.name ? "animated" : "text";
    return "background";
};

const legacyElementsToLayers = (elements?: BannerElementConfig[]): BannerLayer[] => {
    if (!Array.isArray(elements)) return [];
    return elements.map((element, index) => ({
        ...element,
        id: element.id || element.tag || `legacy-${index}`,
        type: element.type || inferLayerTypeFromLegacyElement(element),
        components: legacyElementsToLayers(element.components || element.children || []),
    }));
};

const normalizeBannerTools = (raw: any) => ({
    mode: (raw?.mode === "manual" ? "manual" : "auto") as "manual" | "auto",
    autoplay: raw?.autoplay == null ? true : Boolean(raw?.autoplay),
    intervalMs: Math.max(1000, Math.round(Number(raw?.intervalMs) || 6000)),
    transition: (["fade", "slide", "zoom", "none"].includes(String(raw?.transition || ""))
        ? String(raw?.transition)
        : "fade") as "fade" | "slide" | "zoom" | "none",
});

const normalizeConfigShape = (raw: unknown): DashboardBannerConfig | null => {
    if (!isRecord(raw)) return null;

    const data = isRecord(raw.data) ? raw.data : null;
    const payload =
        data && isRecord(data.banner)
            ? data
            : isRecord(raw.banner)
                ? raw
                : data && Array.isArray((data as any).banners)
                    ? data
                    : Array.isArray((raw as any).banners)
                        ? raw
                : data && Array.isArray(data.layers)
                    ? { banner: data }
                    : null;
    if (!payload) return null;

    const banners: Array<NonNullable<DashboardBannerConfig["banner"]>> = [];
    const unwrapBannerItem = (input: any): Record<string, any> | null => {
        if (!isRecord(input)) return null;
        if (isRecord((input as any).banner)) {
            const inner = (input as any).banner as Record<string, unknown>;
            return {
                ...inner,
                id: (inner as any).id ?? (input as any).id,
            } as Record<string, any>;
        }
        return input as Record<string, any>;
    };

    const processBanner = (b: any) => {
        const sourceBanner = unwrapBannerItem(b);
        if (!isRecord(sourceBanner)) return null;
        const rawLayers = Array.isArray(sourceBanner.layers) ? (sourceBanner.layers as BannerLayer[]) : undefined;
        const rawElements = Array.isArray(sourceBanner.elements) ? (sourceBanner.elements as BannerElementConfig[]) : [];
        const layers = rawLayers ?? legacyElementsToLayers(rawElements);

        const designWidth =
            parsePositiveNumber(sourceBanner.designWidth)
            ?? parsePxValue(sourceBanner.width)
            ?? DEFAULT_DESIGN_WIDTH;

        const aspectRatioCandidate = parsePositiveNumber(sourceBanner.aspectRatio);

        const designHeight =
            parsePositiveNumber(sourceBanner.designHeight)
            ?? parsePxValue(sourceBanner.height)
            ?? (aspectRatioCandidate ? designWidth / aspectRatioCandidate : DEFAULT_DESIGN_HEIGHT);

        const aspectRatio = aspectRatioCandidate ?? (designWidth / designHeight);

        return {
            ...sourceBanner,
            designWidth,
            designHeight,
            aspectRatio,
            height: String(sourceBanner.height || `${designHeight}px`),
            layers,
            elements: rawElements,
        };
    };

    if (Array.isArray(payload.banners)) {
        payload.banners.forEach((b) => {
            const normalized = processBanner(b);
            if (normalized) banners.push(normalized);
        });
    }

    if (isRecord((payload as any).banner)) {
        const normalized = processBanner((payload as any).banner);
        if (normalized && !banners.some((b) => (b as any).id === (normalized as any).id)) {
            banners.push(normalized);
        }
    }

    if (banners.length === 0) return null;

    const normalizedTools = normalizeBannerTools((payload as any).bannerTools);
    const activeBannerIdRaw = (payload as any).activeBannerId;
    const activeBannerId = typeof activeBannerIdRaw === "string" && activeBannerIdRaw.trim().length > 0
        ? activeBannerIdRaw.trim()
        : undefined;

    return {
        banner: banners[0],
        banners,
        bannerTools: normalizedTools,
        activeBannerId,
    };
};

const normalizeMetaShape = (raw: unknown): BannerMeta | null => {
    if (!isRecord(raw)) return null;

    const source = isRecord(raw.data) ? raw.data : raw;
    const hasBanner = typeof source.hasBanner === "boolean" ? source.hasBanner : null;
    if (hasBanner === null) return null;

    const version = source.version == null ? null : String(source.version);
    const lastUpdated = parsePositiveNumber(source.lastUpdated) ?? null;

    return {
        hasBanner,
        version,
        lastUpdated,
    };
};

const hasRenderableBanner = (config: DashboardBannerConfig): boolean => {
    const banner = config.banner;
    if (!banner) return false;

    if (Array.isArray(banner.layers) && banner.layers.length > 0) return true;
    if (Array.isArray(banner.elements) && banner.elements.length > 0) return true;

    const bgImage = String(banner.background?.image || "").trim();
    const bgValue = String(banner.background?.value || "").trim();
    return bgImage.length > 0 || bgValue.length > 0;
};

type FetchBannerResult = {
    state: BannerState;
    meta: BannerMeta | null;
};

type CachedBannerPayload = {
    config: DashboardBannerConfig;
    meta: BannerMeta;
};

export class BannerService {
    constructor(private readonly apiBase: string) { }

    private buildVersion(lastUpdated: number | null): string | null {
        if (typeof lastUpdated !== "number") return null;
        return String(Math.round(lastUpdated));
    }

    private sameVersion(localMeta: BannerMeta, remoteMeta: BannerMeta): boolean {
        if (localMeta.version && remoteMeta.version) {
            return localMeta.version === remoteMeta.version;
        }
        return localMeta.lastUpdated === remoteMeta.lastUpdated;
    }

    private async readCache(): Promise<CachedBannerPayload | null> {
        if (typeof window === "undefined") return null;

        try {
            const [rawConfig, rawMeta] = await Promise.all([
                webStorage.get(BANNER_CACHE_KEY),
                webStorage.get(BANNER_META_KEY),
            ]);

            if (!rawConfig || !rawMeta) return null;

            const parsedConfig = JSON.parse(rawConfig) as unknown;
            const parsedMeta = JSON.parse(rawMeta) as unknown;

            const config = normalizeConfigShape(parsedConfig);
            const meta = normalizeMetaShape(parsedMeta);

            if (!config?.banner || !meta) return null;

            return { config, meta };
        } catch {
            return null;
        }
    }

    private async writeCache(config: DashboardBannerConfig, meta: BannerMeta): Promise<void> {
        if (typeof window === "undefined") return;

        await Promise.all([
            webStorage.set(BANNER_CACHE_KEY, JSON.stringify(config)),
            webStorage.set(BANNER_META_KEY, JSON.stringify(meta)),
        ]);
    }

    private async clearCache(): Promise<void> {
        if (typeof window === "undefined") return;

        await Promise.all([
            webStorage.remove(BANNER_CACHE_KEY),
            webStorage.remove(BANNER_META_KEY),
        ]);
    }

    private async fetchMeta(): Promise<BannerMeta | null> {
        try {
            const url = `${this.apiBase}/banner/meta`;
            const res = await fetch(url, {
                method: "GET",
                headers: { Accept: "application/json" },
                cache: "no-store",
            });

            if (!res.ok) return null;
            const raw = (await res.json()) as unknown;
            return normalizeMetaShape(raw);
        } catch {
            return null;
        }
    }

    private async fetchBanner(): Promise<FetchBannerResult> {
        try {
            const url = `${this.apiBase}/banner`;
            const res = await fetch(url, {
                method: "GET",
                headers: { Accept: "application/json" },
                cache: "no-store",
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = (await res.json()) as unknown;
            const config = normalizeConfigShape(raw);

            if (!config?.banner || !hasRenderableBanner(config)) {
                return {
                    state: { status: "empty" },
                    meta: { hasBanner: false, version: null, lastUpdated: null },
                };
            }

            const source = isRecord(raw) ? raw : null;
            const lastUpdated = parsePositiveNumber(source?.lastUpdated) ?? null;

            return {
                state: {
                    status: "ready",
                    config,
                },
                meta: {
                    hasBanner: true,
                    version: this.buildVersion(lastUpdated),
                    lastUpdated,
                },
            };
        } catch (err) {
            return {
                state: {
                    status: "error",
                    reason: String(err),
                },
                meta: null,
            };
        }
    }

    async resolve(): Promise<BannerState> {
        const cached = await this.readCache();
        const remoteMeta = await this.fetchMeta();

        if (remoteMeta) {
            if (!remoteMeta.hasBanner) {
                await this.clearCache();
                return { status: "empty" };
            }

            if (cached && this.sameVersion(cached.meta, remoteMeta)) {
                return {
                    status: "ready",
                    config: cached.config,
                };
            }

            const fresh = await this.fetchBanner();
            if (fresh.state.status === "ready" && fresh.state.config) {
                const mergedMeta: BannerMeta = {
                    hasBanner: true,
                    version: fresh.meta?.version ?? remoteMeta.version,
                    lastUpdated: fresh.meta?.lastUpdated ?? remoteMeta.lastUpdated,
                };
                await this.writeCache(fresh.state.config, mergedMeta);
                return fresh.state;
            }

            if (fresh.state.status === "empty") {
                await this.clearCache();
                return fresh.state;
            }

            if (cached) {
                return {
                    status: "ready",
                    config: cached.config,
                };
            }

            return fresh.state;
        }

        if (cached) {
            return {
                status: "ready",
                config: cached.config,
            };
        }

        const fresh = await this.fetchBanner();
        if (fresh.state.status === "ready" && fresh.state.config && fresh.meta) {
            await this.writeCache(fresh.state.config, fresh.meta);
        }

        if (fresh.state.status === "empty") {
            await this.clearCache();
        }

        return fresh.state;
    }
}
