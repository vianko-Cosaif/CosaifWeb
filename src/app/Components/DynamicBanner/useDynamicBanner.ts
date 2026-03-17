"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { BannerState, DashboardBannerConfig, BannerLayer } from "./DynamicBanner.types";
import { BannerService } from "./BannerService";

// URL base para el proxy de la API en CosaifWeb
const API_BASE = "/xapi";

const resolveAssetUrl = (url?: string, apiBase = "") => {
    if (!url) return "";
    if (/^data:/i.test(url)) return url;

    if (/^https?:\/\//i.test(url)) {
        try {
            const parsed = new URL(url);
            if (parsed.pathname.startsWith("/banner/assets/")) {
                return `/xapi${parsed.pathname}${parsed.search}`;
            }
            return `${parsed.pathname}${parsed.search}`;
        } catch {
            return url;
        }
    }

    const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
    const assetPath = url.startsWith("/") ? url : `/${url}`;
    return `${base}${assetPath}`;
};

const collectLayerImageUrls = (layer: BannerLayer, apiBase: string, target: Set<string>) => {
    if (!layer || layer.visible === false) return;

    const type = String(layer.type || "").toLowerCase();

    if (type === "image") {
        const src = resolveAssetUrl(layer.src || layer.value || "", apiBase);
        if (src) target.add(src);
    }

    if (type === "background" && String(layer.bgType || "").toLowerCase() === "image") {
        const bgSrc = resolveAssetUrl(layer.value || "", apiBase);
        if (bgSrc) target.add(bgSrc);
    }

    if (type === "lottie") {
        const lottieSrc = resolveAssetUrl(layer.source || "", apiBase);
        if (lottieSrc) target.add(lottieSrc);
    }

    const children = [
        ...(Array.isArray(layer.components) ? layer.components : []),
        ...(Array.isArray(layer.children) ? layer.children : []),
    ];

    children.forEach((child) => collectLayerImageUrls(child, apiBase, target));
};

const collectBannerAssetUrls = (config: DashboardBannerConfig, apiBase: string): string[] => {
    const banners = Array.isArray(config.banners) ? config.banners : config.banner ? [config.banner] : [];
    const urls = new Set<string>();

    banners.forEach((banner) => {
        if (!banner) return;
        const background = banner.background;
        const bgType = String(background?.type || (background as any)?.bgType || "").toLowerCase();
        if (bgType === "image") {
            const src = resolveAssetUrl(background?.image || background?.value || "", apiBase);
            if (src) urls.add(src);
        }

        const layers = Array.isArray(banner.layers) ? banner.layers : [];
        layers.forEach((layer) => collectLayerImageUrls(layer, apiBase, urls));
    });

    return [...urls];
};

const preloadImage = (src: string): Promise<void> =>
    new Promise((resolve) => {
        if (typeof window === "undefined") {
            resolve();
            return;
        }

        const image = new window.Image();
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = src;
    });

export function useDynamicBanner(apiBase: string = API_BASE) {
    const [state, setState] = useState<BannerState>({ status: "loading" });
    const [currentIndex, setCurrentIndex] = useState(0);

    const service = useMemo(() => new BannerService(apiBase), [apiBase]);

    const banners = useMemo(() => {
        if (!state.config?.banners || state.config.banners.length === 0) {
            return state.config?.banner ? [state.config.banner] : [];
        }
        return state.config.banners.filter(Boolean) as Array<NonNullable<DashboardBannerConfig["banner"]>>;
    }, [state.config]);

    const hasExplicitTools = useMemo(() => Boolean(state.config?.bannerTools), [state.config?.bannerTools]);
    const bannerTools = useMemo(() => {
        const raw = state.config?.bannerTools;
        return {
            mode: raw?.mode === "manual" ? "manual" : "auto",
            autoplay: raw?.autoplay == null ? true : Boolean(raw?.autoplay),
            intervalMs: Math.max(1000, Math.round(Number(raw?.intervalMs) || 6000)),
            transition: (["fade", "slide", "zoom", "none"].includes(String(raw?.transition || ""))
                ? String(raw?.transition)
                : "fade") as "fade" | "slide" | "zoom" | "none",
        };
    }, [state.config?.bannerTools]);

    const preloadResources = useCallback(async (config: DashboardBannerConfig) => {
        const urls = collectBannerAssetUrls(config, apiBase);
        if (urls.length === 0) return;
        await Promise.allSettled(urls.map((url) => preloadImage(url)));
    }, [apiBase]);

    const load = useCallback(async () => {
        setState({ status: "loading" });
        const result = await service.resolve();

        if (result.status === "ready" && result.config) {
            await preloadResources(result.config);
        }

        setState(result);
        if (result.status === "ready" && result.config) {
            const nextBanners =
                Array.isArray(result.config.banners) && result.config.banners.length > 0
                    ? result.config.banners
                    : result.config.banner
                        ? [result.config.banner]
                        : [];
            const activeId = typeof result.config.activeBannerId === "string" ? result.config.activeBannerId : "";
            const activeIndex = activeId
                ? nextBanners.findIndex((b) => String((b as any)?.id || "") === activeId)
                : -1;
            setCurrentIndex(activeIndex >= 0 ? activeIndex : 0);
            return;
        }
        setCurrentIndex(0);
    }, [service, preloadResources]);

    useEffect(() => {
        if (currentIndex < banners.length) return;
        setCurrentIndex(0);
    }, [banners.length, currentIndex]);

    useEffect(() => {
        if (banners.length <= 1) return;

        const shouldAutoplay = hasExplicitTools
            ? (bannerTools.mode === "auto" && bannerTools.autoplay)
            : true;
        if (!shouldAutoplay) return;

        const currentBanner = banners[currentIndex];
        const duration = hasExplicitTools
            ? bannerTools.intervalMs
            : (currentBanner?.duration || 5) * 1000;

        const timer = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [bannerTools.autoplay, bannerTools.intervalMs, bannerTools.mode, banners, currentIndex, hasExplicitTools]);

    useEffect(() => {
        void load();
    }, [load]);

    return { 
        ...state, 
        reload: load, 
        currentIndex, 
        bannerTools,
        banners, 
        banner: banners.length > 0 ? banners[currentIndex] : undefined 
    };
}
