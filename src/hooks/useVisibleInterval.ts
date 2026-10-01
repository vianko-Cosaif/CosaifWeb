// src/hooks/useVisibleInterval.ts
"use client";
import { useEffect } from "react";

export function useVisibleInterval(cb: () => void, ms: number | null | undefined) {
  useEffect(() => {
    if (!ms) return;
    let alive = true;
    const tick = () => { if (alive && document.visibilityState === "visible") cb(); };
    const id = window.setInterval(tick, ms);
    const onVis = () => document.visibilityState === "visible" && cb();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cb, ms]);
}
