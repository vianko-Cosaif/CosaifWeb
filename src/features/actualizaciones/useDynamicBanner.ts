"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { BannerState, DashboardBannerConfig } from "./DynamicBanner.types";
import { BannerService } from "./BannerService";

// URL base para el proxy de la API en CosaifWeb
const API_BASE = "/xapi";

export function useDynamicBanner(apiBase: string = API_BASE) {
    const [state, setState] = useState<BannerState>({ status: "loading" });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [visible, setVisible] = useState(true);
    const loadGeneration = useRef(0);

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

    const load = useCallback(async () => {
        const generation = ++loadGeneration.current;
        const cached = await service.resolveCached();
        if (generation !== loadGeneration.current) return;
        if (cached) {
            setState(cached);
            if (cached.config) {
                const nextBanners =
                    Array.isArray(cached.config.banners) && cached.config.banners.length > 0
                        ? cached.config.banners
                        : cached.config.banner
                            ? [cached.config.banner]
                            : [];
                const activeId = typeof cached.config.activeBannerId === "string" ? cached.config.activeBannerId : "";
                const activeIndex = activeId
                    ? nextBanners.findIndex((b) => String(b?.id || "") === activeId)
                    : -1;
                setCurrentIndex(activeIndex >= 0 ? activeIndex : 0);
            }
        } else {
            setState({ status: "loading" });
        }

        const result = await service.resolve();

        if (generation !== loadGeneration.current) return;

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
                ? nextBanners.findIndex((b) => String(b?.id || "") === activeId)
                : -1;
            
            setCurrentIndex((prev) => {
                if (cached && activeIndex < 0) {
                    return prev;
                }
                return activeIndex >= 0 ? activeIndex : 0;
            });
            return;
        }
        setCurrentIndex(0);
    }, [service]);

    useEffect(() => {
        if (currentIndex < banners.length) return;
        setCurrentIndex(0);
    }, [banners.length, currentIndex]);

    useEffect(() => {
        if (!visible || banners.length <= 1) return;

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
    }, [bannerTools.autoplay, bannerTools.intervalMs, bannerTools.mode, banners, currentIndex, hasExplicitTools, visible]);

    useEffect(() => {
        const onVisibility = () => setVisible(document.visibilityState !== "hidden");
        onVisibility();
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, []);

    useEffect(() => {
        // Only the rendered banner loads its images. Waiting for every slide's
        // assets delayed the initial display and competed with operational data.
        void load();
        return () => { loadGeneration.current += 1; };
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
