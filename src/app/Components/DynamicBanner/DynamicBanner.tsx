"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useDynamicBanner } from "./useDynamicBanner";
import type { BannerLayer } from "./DynamicBanner.types";
import "./DynamicBanner.scss";

const DEFAULT_DESIGN_WIDTH = 800;
const DEFAULT_DESIGN_HEIGHT = 220;

const ANIMATION_MAP: Record<string, string> = {
  slideInLeft: "banner-slideInLeft",
  slideInUp: "banner-slideInUp",
  slideInRight: "banner-slideInRight",
  slideAcrossRight: "banner-slideAcrossRight",
  fadeIn: "banner-fadeIn",
  zoomIn: "banner-zoomIn",
};

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

const resolveCanvasMetrics = (banner: any) => {
  const designWidth =
    parsePositiveNumber(banner?.designWidth)
    ?? parsePxValue(banner?.width)
    ?? DEFAULT_DESIGN_WIDTH;

  const ratioCandidate = parsePositiveNumber(banner?.aspectRatio);
  const designHeight =
    parsePositiveNumber(banner?.designHeight)
    ?? parsePxValue(banner?.height)
    ?? (ratioCandidate ? designWidth / ratioCandidate : DEFAULT_DESIGN_HEIGHT);

  const aspectRatio = ratioCandidate ?? (designWidth / designHeight);
  return { designWidth, designHeight, aspectRatio };
};

const resolveWebAnimationStyle = (animation?: BannerLayer["animation"]): React.CSSProperties => {
  if (!animation?.name) return {};
  return {
    opacity: 0,
    animationName: ANIMATION_MAP[animation.name] || animation.name,
    animationDuration: animation.duration || "0.9s",
    animationDelay: animation.delay || "0s",
    animationTimingFunction: animation.easing || animation.timingFunction || "ease",
    animationIterationCount: animation.iterationCount ?? 1,
    animationFillMode: animation.fillMode || "forwards",
  };
};

const resolveAssetUrl = (url?: string, apiBase = "") => {
  if (!url) return "";
  if (/^data:/i.test(url)) return url;

  // BackCosaif expone assets en /banner/assets/:assetName.
  // Si llega una URL absoluta, la enroutamos por el proxy interno /xapi
  // para evitar errores de host en next/image y mantener un solo origen.
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

const resolveRootBackground = (banner: any, apiBase: string) => {
  const background = banner?.background;
  if (!background) return undefined;

  const imageCandidate =
    background.image ||
    (typeof background.value === "string" && background.value.includes("/assets/") ? background.value : "");

  const value =
    background.bgType === "image" || background.type === "image"
      ? imageCandidate || background.value
      : background.value || background.image;

  if (!value) return undefined;
  if (
    background.bgType === "image" ||
    background.type === "image" ||
    String(value).includes("/assets/") ||
    /^https?:\/\//i.test(String(value))
  ) {
    const fit = background.fit || "cover";
    const pos = background.position || "center";
    return `url(${resolveAssetUrl(String(value), apiBase)}) ${pos} / ${fit} no-repeat`;
  }

  return String(value);
};

const hasRenderableBackground = (banner: any) => {
  const background = banner?.background;
  if (!background) return false;
  const value = String(background.value || "").trim();
  const image = String(background.image || "").trim();
  return Boolean(value || image);
};

const hasOffsetProps = (styles: React.CSSProperties): boolean =>
  styles.top !== undefined
  || styles.left !== undefined
  || styles.right !== undefined
  || styles.bottom !== undefined
  || styles.inset !== undefined;

const resolveLayerChildren = (layer: BannerLayer): BannerLayer[] => {
  const list = (layer as any).components ?? (layer as any).children;
  return Array.isArray(list) ? list : [];
};

const NodeCanvas = React.memo(function NodeCanvas({ opacity = 0.2, style }: { opacity?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    const draw = (w: number, h: number) => {
      node.width = w;
      node.height = h;
      const ctx = node.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i += 1) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width: w, height: h } = entry.contentRect;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => draw(Math.round(w), Math.round(h)));
        }
      });
      observer.observe(node);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(raf);
      };
    }

    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => draw(node.offsetWidth, node.offsetHeight));
    };

    draw(node.offsetWidth, node.offsetHeight);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="banner-layer-canvas"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
});

const ParticleEffect = React.memo(function ParticleEffect({
  effect,
  density,
  color,
  style,
}: {
  effect: string;
  density?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  const normalizedDensity =
    density == null
      ? 0.5
      : density > 1
        ? Math.min(density, 100) / 100
        : Math.max(0, density);
  const count = Math.max(1, Math.floor(normalizedDensity * 140));

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${2 + Math.random() * 3}s`,
        opacity: 0.1 + Math.random() * 0.5,
      })),
    [count],
  );

  return (
    <div
      className={`banner-particles banner-particles--${effect}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background: "transparent",
        backgroundColor: "transparent",
        color: color || "white",
        ...style,
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="particle"
          style={{
            left: particle.left,
            top: "-20px",
            opacity: particle.opacity,
            animation:
              effect === "stars"
                ? `banner-fadeIn 1s alternate infinite ${particle.delay}`
                : `particle-fall ${particle.duration} linear infinite ${particle.delay}`,
          }}
        />
      ))}
    </div>
  );
});

export default function DynamicBanner({
  apiBase: propApiBase,
  className,
}: {
  apiBase?: string;
  className?: string;
}) {
  const { status, banner, currentIndex, bannerTools } = useDynamicBanner(propApiBase);
  const apiBase = propApiBase || "";
  const [screenWidth, setScreenWidth] = useState(1200);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_DESIGN_WIDTH);
  const [rootNode, setRootNode] = useState<HTMLDivElement | null>(null);
  const rootRef = useCallback((node: HTMLDivElement | null) => {
    setRootNode(node);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScreenWidth(window.innerWidth));
    };
    setScreenWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rootNode) return;

    let raf = 0;
    const update = (width?: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setContainerWidth(width ?? rootNode.clientWidth ?? DEFAULT_DESIGN_WIDTH);
      });
    };

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          update(Math.round(entry.contentRect.width));
        }
      });
      observer.observe(rootNode);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(raf);
      };
    }

    const legacyUpdate = () => update();
    legacyUpdate();
    window.addEventListener("resize", legacyUpdate);
    return () => {
      window.removeEventListener("resize", legacyUpdate);
      cancelAnimationFrame(raf);
    };
  }, [rootNode]);

  const resolveResponsiveStyles = useCallback(
    (layer: BannerLayer): React.CSSProperties => {
      let merged: React.CSSProperties = { ...(layer.styles || {}) };
      if (!layer.media) return merged;
      const breakpoints = Object.keys(layer.media).sort((a, b) => Number(a) - Number(b));
      for (const breakpoint of breakpoints) {
        if (screenWidth <= Number(breakpoint)) {
          merged = {
            ...merged,
            ...(layer.media[breakpoint] || {}),
          };
        }
      }
      return merged;
    },
    [screenWidth],
  );

  const renderLayer = useCallback(
    (layer: BannerLayer, index: number, isNested = false): React.ReactNode => {
      if (!layer || layer.visible === false) return null;

      const style: React.CSSProperties = {
        ...resolveResponsiveStyles(layer),
        ...resolveWebAnimationStyle(layer.animation),
      };

      if (!isNested && style.position === undefined) {
        style.position = "absolute";
        if (style.inset === undefined && !hasOffsetProps(style)) {
          style.top = 0;
          style.left = 0;
          style.right = 0;
          style.bottom = 0;
        }
        if (style.zIndex === undefined) style.zIndex = index;
      }

      if (isNested && style.position === undefined && hasOffsetProps(style)) {
        style.position = "absolute";
      }

      if (resolveLayerChildren(layer).length > 0 && style.position === undefined) {
        style.position = "relative";
      }

      const key = layer.id || `${isNested ? "nested" : "root"}-${index}`;
      const children = resolveLayerChildren(layer).map((component, childIndex) => renderLayer(component, childIndex, true));

      switch (layer.type) {
        case "background": {
          const backgroundValue = layer.value || "";
          if (style.background === undefined && style.backgroundImage === undefined && backgroundValue) {
            if (layer.bgType === "image") {
              const fit = layer.fit || "cover";
              const pos = layer.position || "center";
              style.background = `url(${resolveAssetUrl(backgroundValue, apiBase)}) ${pos}/${fit} no-repeat`;
            } else if (layer.bgType === "gradient") {
              style.background = backgroundValue;
            } else {
              style.background = backgroundValue;
            }
          }
          return (
            <div key={key} style={style}>
              {children}
            </div>
          );
        }

        case "canvas":
          if (layer.effect === "nodes") {
            return <NodeCanvas key={key} opacity={layer.intensity} style={style} />;
          }
          return null;

        case "particles": {
          const overlayStyle: React.CSSProperties = {
            ...style,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            background: "transparent",
            backgroundColor: "transparent",
            zIndex: style.zIndex ?? index + 10,
          };
          return <ParticleEffect key={key} effect={layer.effect || "rain"} density={layer.density} color={layer.color} style={overlayStyle} />;
        }

        case "lottie":
          return (
            <div
              key={key}
              style={{
                ...style,
                width: style.width || 44,
                height: style.height || 44,
                border: "1px dashed rgba(255,255,255,0.3)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                color: "white",
              }}
            >
              Lottie
              {children}
            </div>
          );

        case "image": {
          const imageSrc = resolveAssetUrl(layer.src || layer.value || "", apiBase);
          if (!imageSrc) return null;
          const isLCP = Boolean(layer.lcp || layer.priority);
          const isBackCosaifAsset = imageSrc.startsWith("/xapi/banner/assets/");
          return (
            <div key={key} style={style}>
              <Image
                src={imageSrc}
                alt={layer.alt || ""}
                fill
                priority={isLCP}
                unoptimized={isBackCosaifAsset}
                fetchPriority={isLCP ? "high" : "auto"}
                sizes="(max-width: 800px) 100vw, 800px"
                style={{
                  objectFit: layer.fit || "cover",
                  objectPosition: layer.position || "center",
                  borderRadius: "inherit",
                  display: "block",
                  ...((layer as any).imageStyles || {}),
                }}
              />
              {children}
            </div>
          );
        }

        case "text":
        case "animated": {
          const htmlValue = layer.content || layer.value || "";
          if (!htmlValue) return children || null;
          const Tag =
            layer.tag && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(layer.tag)
              ? (layer.tag as keyof React.JSX.IntrinsicElements)
              : "span";
          return React.createElement(
            Tag,
            { key, style },
            <>
              <span dangerouslySetInnerHTML={{ __html: htmlValue }} />
              {children}
            </>,
          );
        }

        case "group":
        case "components":
          return (
            <div key={key} style={style}>
              {children}
            </div>
          );

        default:
          return null;
      }
    },
    [apiBase, resolveResponsiveStyles],
  );

  if (status === "loading" || status === "empty") return null;
  if (status === "error") return null;
  if (!banner) return null;
  const layers = Array.isArray(banner.layers) ? banner.layers : [];
  const hasLayers = layers.length > 0;
  const hasBackground = hasRenderableBackground(banner);
  if (!hasLayers && !hasBackground) return null;

  const { designWidth, designHeight } = resolveCanvasMetrics(banner);
  const safeContainerWidth = containerWidth > 0 ? containerWidth : designWidth;
  const scale = safeContainerWidth / designWidth;
  const stableScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const rootHeightPx = Math.max(1, Math.round(designHeight * stableScale));

  const rootStyle: React.CSSProperties = {
    width: banner.width || "100%",
    height: `${rootHeightPx}px`,
    ...((banner.styles || {}) as React.CSSProperties),
    position: "relative",
    overflow: "hidden",
    isolation: "isolate",
    minHeight: `${rootHeightPx}px`,
  };

  const resolvedBackground = resolveRootBackground(banner, apiBase);
  if (resolvedBackground) {
    rootStyle.background = resolvedBackground;
  }

  const stageStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: `${designWidth}px`,
    height: `${designHeight}px`,
    transform: `scale(${stableScale})`,
    transformOrigin: "top left",
    willChange: "transform",
  };

  const rootTransitionAnimation = (() => {
    switch (bannerTools?.transition) {
      case "none":
        return "none";
      case "slide":
        return "banner-change-slide 0.5s ease-out forwards";
      case "zoom":
        return "banner-change-zoom 0.45s ease-out forwards";
      case "fade":
      default:
        return "banner-change-fade 0.6s ease-out forwards";
    }
  })();

  return (
    <div className={`db-wrapper ${className || ""}`}>
      <div
        ref={rootRef}
        key={`banner-root-${banner.id || "banner"}-${currentIndex}`}
        className="banner-root-v2"
        style={{
          ...rootStyle,
          animation: rootTransitionAnimation,
        }}
        onClick={() => {
          if (banner.actionUrl) window.open(banner.actionUrl, "_blank", "noopener,noreferrer");
        }}
      >
        {hasLayers ? (
          <div style={stageStyle}>{layers.map((layer, index) => renderLayer(layer, index))}</div>
        ) : null}
      </div>
    </div>
  );
}
