// src/hooks/useMediaQuery.ts
import { useEffect, useMemo, useRef, useState } from "react";

/** Tailwind (default) breakpoints in px */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;
export type Breakpoint = keyof typeof breakpoints;

/**
 * SSR-safe media query hook.
 * - Returns `initial` on the server, and the real value after mount.
 * - Subscribes to MQ changes with modern & legacy listeners.
 */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState<boolean>(initial);
  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;

    const mql = window.matchMedia(queryRef.current);
    // Set immediately on mount to avoid an extra paint
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setMatches("matches" in e ? e.matches : (e as MediaQueryList).matches);

    // Modern
    if ("addEventListener" in mql) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Legacy Safari
    // @ts-expect-error - older types
    mql.addListener(onChange);
    // @ts-expect-error - older types
    return () => mql.removeListener(onChange);
  }, []);

  return matches;
}

/** Min-width (Tailwind-style) — e.g. md↑ */
export function useUp(bp: Breakpoint, initial = false) {
  return useMediaQuery(`(min-width: ${breakpoints[bp]}px)`, initial);
}

/** Max-width (exclusive) — e.g. md↓ (one subpixel below to avoid overlap) */
export function useDown(bp: Breakpoint, initial = false) {
  const max = breakpoints[bp] - 0.02; // avoid equality overlap with min-width
  return useMediaQuery(`(max-width: ${max}px)`, initial);
}

/** Between two breakpoints (inclusive min, exclusive max) */
export function useBetween(min: Breakpoint, max: Breakpoint, initial = false) {
  const q = useMemo(() => {
    const a = breakpoints[min];
    const b = breakpoints[max] - 0.02;
    return `(min-width: ${a}px) and (max-width: ${b}px)`;
  }, [min, max]);
  return useMediaQuery(q, initial);
}

/** System preference: dark mode */
export function usePrefersDark(initial = false) {
  return useMediaQuery("(prefers-color-scheme: dark)", initial);
}

/** System preference: reduced motion */
export function usePrefersReducedMotion(initial = false) {
  return useMediaQuery("(prefers-reduced-motion: reduce)", initial);
}

/** Orientation helper */
export function usePortrait(initial = false) {
  return useMediaQuery("(orientation: portrait)", initial);
}
