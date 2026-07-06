"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
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
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage.getItem(key);
    return raw === null ? initial : raw === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // localStorage puede fallar en modo privado; el estado en memoria basta.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useOnline() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
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
