"use client";

import { useEffect } from "react";

function viewportMode(width: number) {
  if (width < 768) return "mobile";
  if (width < 1180) return "tablet";
  return "desktop";
}

export default function AdaptiveMode() {
  useEffect(() => {
    const root = document.documentElement;
    const touchQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    const update = () => {
      const nav = navigator as Navigator & { standalone?: boolean };
      root.dataset.cosaifViewport = viewportMode(window.innerWidth);
      root.dataset.cosaifInput = touchQuery.matches ? "touch" : "pointer";
      root.dataset.cosaifStandalone = standaloneQuery.matches || nav.standalone ? "true" : "false";
    };

    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    touchQuery.addEventListener("change", update);
    standaloneQuery.addEventListener("change", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      touchQuery.removeEventListener("change", update);
      standaloneQuery.removeEventListener("change", update);
    };
  }, []);

  return null;
}
