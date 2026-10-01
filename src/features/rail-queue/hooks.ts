"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList, type SetStateAction } from "react";
import type { Toast, ToastKind } from "./types";

export function useVisibleInterval(
  fn: () => void,
  delay: number | null,
  deps: DependencyList = []
) {
  useEffect(() => {
    if (!delay) return;
    const tick = () => {
      if (document.visibilityState === "visible") fn();
    };
    const id = window.setInterval(tick, delay);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps]);
}

export function useLocalStorageBoolean(key: string, initial = false) {
  // The first client render must match the HTML rendered on the server.
  const [preference, setPreference] = useState({ key: null as string | null, value: initial, canPersist: false });

  useEffect(() => {
    let value = initial;
    let canPersist = false;
    try {
      const raw = window.localStorage.getItem(key);
      value = raw === null ? initial : raw === "1";
      canPersist = true;
    } catch {
      // Keep a usable in-memory preference if storage is unavailable.
    }
    setPreference({ key, value, canPersist });
  }, [key, initial]);

  useEffect(() => {
    // Never persist the SSR default before reading this key's saved preference.
    if (preference.key !== key || !preference.canPersist) return;
    try {
      window.localStorage.setItem(key, preference.value ? "1" : "0");
    } catch {
      // localStorage puede fallar en modo privado; el estado en memoria basta.
    }
  }, [key, preference]);

  const setValue = useCallback((update: SetStateAction<boolean>) => {
    setPreference((current) => {
      const previous = current.key === key ? current.value : initial;
      const value = typeof update === "function" ? update(previous) : update;
      if (current.key === key && current.value === value) return current;
      return { key, value, canPersist: current.key === key && current.canPersist };
    });
  }, [key, initial]);

  return [preference.key === key ? preference.value : initial, setValue] as const;
}

export function useOnline() {
  // Node 24 has navigator but no onLine. Keep the server and first browser
  // render identical, then synchronize the browser's connection state.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

export function useRelativeClock(periodMs = 30_000) {
  const [, force] = useState(0);
  useVisibleInterval(() => force((value) => value + 1), periodMs, [periodMs]);
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((text: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, kind }]);
    const timerId = window.setTimeout(() => dismiss(id), 5000);
    timers.current.push(timerId);
  }, [dismiss]);

  return { toasts, push, dismiss, setToasts };
}
