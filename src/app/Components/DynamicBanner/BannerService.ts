import type {
    DashboardBannerConfig,
    BannerState,
    BannerElementConfig,
    BannerLayer,
    BannerLayerType,
    BannerMeta,
} from "./DynamicBanner.types";
import { webStorage } from "./DynamicBanner.storage";
import { getClientCookie } from "@/lib/cookies";

const DEFAULT_DESIGN_WIDTH = 800;
const DEFAULT_DESIGN_HEIGHT = 220;
const BANNER_CACHE_KEY = "dynamicBanner.cache.config.v2";
const BANNER_META_KEY = "dynamicBanner.cache.meta.v2";

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

const parseOrder = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.round(parsed);
};

const normalizeBannerId = (value: unknown) => String(value || "").trim();

const normalizeBannerName = (value: unknown, fallbackIndex: number) => {
    const raw = String(value || "").trim();
    return raw || `Banner ${fallbackIndex + 1}`;
};

const buildOrderMap = (payload: any) => {
    const orderMap = new Map<string, number>();
    const setFrom = (candidate: any, fallbackIndex: number) => {
        if (!isRecord(candidate)) return;
        const id = normalizeBannerId((candidate as any).id ?? (candidate as any).banner?.id);
        if (!id || orderMap.has(id)) return;
        orderMap.set(id, parseOrder((candidate as any).order, fallbackIndex));
    };

    if (Array.isArray((payload as any)?.bannerItems)) {
        (payload as any).bannerItems.forEach((item: any, index: number) => setFrom(item, index));
    }
    if (Array.isArray((payload as any)?.availableBanners)) {
        (payload as any).availableBanners.forEach((item: any, index: number) => setFrom(item, index));
    }
    if (Array.isArray((payload as any)?.banners)) {
        (payload as any).banners.forEach((item: any, index: number) => setFrom(item, index));
    }
    return orderMap;
};

const dedupeAndSortBanners = (
    banners: Array<NonNullable<DashboardBannerConfig["banner"]>>,
    orderMap: Map<string, number>,
) => {
    const deduped: Array<NonNullable<DashboardBannerConfig["banner"]>> = [];
    const seenIds = new Set<string>();
    banners.forEach((banner) => {
        const id = normalizeBannerId((banner as any)?.id);
        if (id) {
            if (seenIds.has(id)) return;
            seenIds.add(id);
        }
        deduped.push(banner);
    });

    const ranked = deduped.map((banner, index) => {
        const id = normalizeBannerId((banner as any)?.id);
        const rank = id && orderMap.has(id) ? orderMap.get(id)! : Number.MAX_SAFE_INTEGER;
        return { banner, index, rank };
    });

    ranked.sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank));
    return ranked.map((item) => item.banner);
};

const normalizeUserType = (value: unknown): string | null => {
    const raw = String(value || "").trim().toUpperCase();
    return raw || null;
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
    const orderMap = buildOrderMap(payload as any);

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
    const orderedBanners = dedupeAndSortBanners(banners, orderMap);

    const normalizedTools = normalizeBannerTools((payload as any).bannerTools);
    const activeBannerIdRaw = (payload as any).activeBannerId;
    const activeBannerId = typeof activeBannerIdRaw === "string" && activeBannerIdRaw.trim().length > 0
        ? activeBannerIdRaw.trim()
        : undefined;
    const selectedBanner = activeBannerId
        ? orderedBanners.find((banner) => normalizeBannerId((banner as any)?.id) === activeBannerId) || orderedBanners[0]
        : orderedBanners[0];

    const bannerItems = orderedBanners.map((banner, index) => {
        const id = normalizeBannerId((banner as any)?.id) || `banner-${index + 1}`;
        const order = orderMap.has(id) ? orderMap.get(id)! : parseOrder((banner as any)?.order, index);
        return {
            id,
            name: normalizeBannerName((banner as any)?.name, index),
            order,
            banner,
        };
    });
    bannerItems.sort((a, b) => (a.order === b.order ? 0 : a.order - b.order));
    const availableBanners = bannerItems.map(({ id, name, order }) => ({ id, name, order }));

    return {
        banner: selectedBanner ?? bannerItems[0]?.banner,
        banners: bannerItems.map((item) => item.banner),
        bannerTools: normalizedTools,
        activeBannerId: normalizeBannerId((selectedBanner as any)?.id) || normalizeBannerId((bannerItems[0]?.banner as any)?.id),
        availableBanners,
        bannerItems,
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

    private resolveUserType(): string | null {
        if (typeof window === "undefined") return null;
        return normalizeUserType(
            getClientCookie("role")
            ?? getClientCookie("rol")
            ?? getClientCookie("userType")
        );
    }

    private buildConfigCacheKey(userType: string | null): string {
        return `${BANNER_CACHE_KEY}:${userType || "ALL"}`;
    }

    private buildMetaCacheKey(userType: string | null): string {
        return `${BANNER_META_KEY}:${userType || "ALL"}`;
    }

    private buildRoleAwareUrl(path: string, userType: string | null): string {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        if (!userType) return `${this.apiBase}${normalizedPath}`;
        const params = new URLSearchParams({ userType });
        return `${this.apiBase}${normalizedPath}?${params.toString()}`;
    }

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

    private async readCache(userType: string | null): Promise<CachedBannerPayload | null> {
        if (typeof window === "undefined") return null;

        try {
            const cacheConfigKey = this.buildConfigCacheKey(userType);
            const cacheMetaKey = this.buildMetaCacheKey(userType);
            const [rawConfig, rawMeta] = await Promise.all([
                webStorage.get(cacheConfigKey),
                webStorage.get(cacheMetaKey),
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

    private async writeCache(config: DashboardBannerConfig, meta: BannerMeta, userType: string | null): Promise<void> {
        if (typeof window === "undefined") return;

        const cacheConfigKey = this.buildConfigCacheKey(userType);
        const cacheMetaKey = this.buildMetaCacheKey(userType);
        await Promise.all([
            webStorage.set(cacheConfigKey, JSON.stringify(config)),
            webStorage.set(cacheMetaKey, JSON.stringify(meta)),
        ]);
    }

    private async clearCache(userType: string | null): Promise<void> {
        if (typeof window === "undefined") return;

        const cacheConfigKey = this.buildConfigCacheKey(userType);
        const cacheMetaKey = this.buildMetaCacheKey(userType);
        await Promise.all([
            webStorage.remove(cacheConfigKey),
            webStorage.remove(cacheMetaKey),
        ]);
    }

    private async fetchMeta(userType: string | null): Promise<BannerMeta | null> {
        try {
            const url = this.buildRoleAwareUrl("/banner/meta", userType);
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

    private async fetchBanner(userType: string | null): Promise<FetchBannerResult> {
        try {
            const url = this.buildRoleAwareUrl("/banner", userType);
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
        const userType = this.resolveUserType();
        const cached = await this.readCache(userType);
        const remoteMeta = await this.fetchMeta(userType);

        if (remoteMeta) {
            if (!remoteMeta.hasBanner) {
                await this.clearCache(userType);
                return { status: "empty" };
            }

            if (cached && this.sameVersion(cached.meta, remoteMeta)) {
                return {
                    status: "ready",
                    config: cached.config,
                };
            }

            const fresh = await this.fetchBanner(userType);
            if (fresh.state.status === "ready" && fresh.state.config) {
                const mergedMeta: BannerMeta = {
                    hasBanner: true,
                    version: fresh.meta?.version ?? remoteMeta.version,
                    lastUpdated: fresh.meta?.lastUpdated ?? remoteMeta.lastUpdated,
                };
                await this.writeCache(fresh.state.config, mergedMeta, userType);
                return fresh.state;
            }

            if (fresh.state.status === "empty") {
                await this.clearCache(userType);
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

        const fresh = await this.fetchBanner(userType);
        if (fresh.state.status === "ready" && fresh.state.config && fresh.meta) {
            await this.writeCache(fresh.state.config, fresh.meta, userType);
        }

        if (fresh.state.status === "empty") {
            await this.clearCache(userType);
        }

        return fresh.state;
    }

    async resolveCached(): Promise<BannerState | null> {
        const userType = this.resolveUserType();
        const cached = await this.readCache(userType);
        if (cached) {
            return {
                status: "ready",
                config: cached.config,
            };
        }
        return null;
    }
}
