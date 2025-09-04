// src/hooks/useLocalStorage.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLocalStorageOptions<T> {
  /** Serializa el valor antes de guardarlo (por defecto JSON.stringify) */
  serialize?: (v: T) => string;
  /** Deserializa el valor leído (por defecto JSON.parse, con fallback a string) */
  deserialize?: (v: string) => T;
  /** Escucha cambios desde otras pestañas (storage event). Default: true */
  syncTabs?: boolean;
}

export type UseLocalStorageReturn<T> = [
  T,
  (next: T | ((prev: T) => T)) => void,
  { remove: () => void; isSupported: boolean }
];

export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
  opts: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const { serialize, deserialize, syncTabs = true } = opts;
  const ser = useRef<(v: T) => string>(serialize ?? defaultSerialize);
  const de = useRef<(v: string) => T>(deserialize ?? defaultDeserialize);
  const supported = isStorageAvailable("localStorage");

  const readStored = useCallback((): T => {
    if (!supported) return resolveInitial(initialValue);
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return resolveInitial(initialValue);
      return de.current(raw);
    } catch {
      return resolveInitial(initialValue);
    }
  }, [initialValue, key, supported]);

  const [state, setState] = useState<T>(() => {
    // Evita romper SSR; si no hay window aún, usa initial y luego hidrata en effect
    if (typeof window === "undefined") return resolveInitial(initialValue);
    return readStored();
  });

  // Hidrata/actualiza si cambia la clave
  useEffect(() => {
    setState(readStored());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Sync entre pestañas
  useEffect(() => {
    if (!syncTabs || !supported) return;
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return;
      if (e.key !== key) return;
      try {
        if (e.newValue == null) {
          setState(resolveInitial(initialValue));
        } else {
          setState(de.current(e.newValue));
        }
      } catch {
        // ignora errores de parse
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [initialValue, key, supported, syncTabs]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (supported) {
          try {
            window.localStorage.setItem(key, ser.current(value));
          } catch {
            // cuota llena o modo incógnito; no rompas UI
          }
        }
        return value;
      });
    },
    [key, supported]
  );

  const remove = useCallback(() => {
    if (supported) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
    setState(resolveInitial(initialValue));
  }, [initialValue, key, supported]);

  return [state, set, { remove, isSupported: supported }];
}

/* ---------- utils ---------- */
function isStorageAvailable(type: "localStorage" | "sessionStorage"): boolean {
  try {
    if (typeof window === "undefined") return false;
    const storage = window[type];
    const test = "__storage_test__";
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function resolveInitial<T>(v: T | (() => T)): T {
  return typeof v === "function" ? (v as () => T)() : v;
}

function defaultSerialize<T>(v: T): string {
  try {
    return JSON.stringify(v);
  } catch {
    // como fallback, guarda como string plano
    return String(v as unknown);
  }
}

function defaultDeserialize<T>(v: string): T {
  try {
    return JSON.parse(v) as T;
  } catch {
    return (v as unknown) as T;
  }
}

export default useLocalStorage;
