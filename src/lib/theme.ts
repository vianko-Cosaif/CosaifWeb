// src/lib/theme.ts

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_KEY = THEME_STORAGE_KEY; // alias usado por componentes
export const MEDIA_QUERY = "(prefers-color-scheme: dark)";

/** Lee el tema guardado en localStorage (o null si no hay). */
export function getStoredTheme(): ThemeMode | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/** Devuelve el tema preferido por el sistema (dark/light). */
export function getPreferredThemeFromMedia(): ThemeMode {
  try {
    if (typeof window === "undefined") return "light";
    return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Tema inicial: prioriza guardado; si no, media query del SO. */
export function getInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getPreferredThemeFromMedia();
}

/** Aplica o quita la clase `dark` en el `<html>` (o en `root` si se pasa). */
export function applyDarkClass(dark: boolean, root?: HTMLElement): void {
  try {
    const el = root ?? (typeof document !== "undefined" ? document.documentElement : null);
    if (!el) return;
    el.classList.toggle("dark", dark);
  } catch {}
}

/** Aplica un tema y opcionalmente lo persiste en localStorage. */
export function applyTheme(
  mode: ThemeMode,
  opts: { persist?: boolean; root?: HTMLElement } = {}
): ThemeMode {
  const { persist = true, root } = opts;
  applyDarkClass(mode === "dark", root);
  if (persist) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    } catch {}
  }
  return mode;
}

/** Alterna el tema actual (si no se pasa, detecta inicial) y lo aplica. */
export function toggleTheme(
  current?: ThemeMode,
  opts: { persist?: boolean; root?: HTMLElement } = {}
): ThemeMode {
  const cur =
    current ??
    (typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : getInitialTheme());
  const next: ThemeMode = cur === "dark" ? "light" : "dark";
  return applyTheme(next, opts);
}

/** Conveniencias para componentes (compat con ThemeToggle). */
export function getTheme(): ThemeMode {
  return getInitialTheme();
}
export function setTheme(mode: ThemeMode): void {
  applyTheme(mode, { persist: true });
}

/**
 * Suscribe un callback a cambios de tema entre pestañas (storage event).
 * Devuelve una función para desuscribir.
 */
export function onThemeChange(cb: (mode: ThemeMode) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY && e.newValue) {
      const v = e.newValue === "dark" ? "dark" : "light";
      cb(v);
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", handler);
  return () => {
    if (typeof window !== "undefined") window.removeEventListener("storage", handler);
  };
}

/** True si el documento está actualmente en modo oscuro. */
export function isDark(): boolean {
  try {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
  } catch {}
  return false;
}

/**
 * Script inline (string) para evitar FOUC de tema antes de hidratar.
 * Úsalo en `<head>` con `dangerouslySetInnerHTML`.
 */
export function initThemeSSRScript(storageKey = THEME_STORAGE_KEY): string {
  return `(function(){try{var k='${storageKey}';var t=localStorage.getItem(k);var m=window.matchMedia&&window.matchMedia('${MEDIA_QUERY}').matches;var dark=t?t==='dark':m;document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;
}
