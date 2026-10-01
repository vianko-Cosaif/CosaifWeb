// src/app/Components/ui/ThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import {
  type ThemeMode,
  getInitialTheme,
  applyTheme,
  onThemeChange,
} from "@/lib/theme";
import { useMounted } from "@/hooks/useMounted";
type Size = "sm" | "md" | "lg";

export default function ThemeToggle({
  className = "",
  size = "md",
  withLabel = false,
  labels = { light: "Claro", dark: "Oscuro" },
  title = "Cambiar tema",
}: {
  className?: string;
  size?: Size;
  withLabel?: boolean;
  labels?: { light: string; dark: string };
  title?: string;
}) {
  const mounted = useMounted();
  const [mode, setMode] = useState<ThemeMode>("light");

  // init + evitar FOUC/hydration mismatch
  useEffect(() => {
    if (!mounted) return;
    const initial = getInitialTheme();
    setMode(initial);
    applyTheme(initial, { persist: false });
  }, [mounted]);

  // sync entre pestañas
  useEffect(() => onThemeChange((next) => {
    setMode(next);
    applyTheme(next, { persist: false });
  }), []);

  if (!mounted) {
    return (
      <span
        className={[baseBtn(withLabel, size), "opacity-0", className].join(" ")}
        aria-hidden
      />
    );
  }

  const isDark = mode === "dark";
  const next: ThemeMode = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        setMode(next);
        applyTheme(next, { persist: true });
      }}
      className={[baseBtn(withLabel, size), className].join(" ")}
      title={`${title}: activar modo ${isDark ? labels.light.toLowerCase() : labels.dark.toLowerCase()}`}
      aria-pressed={isDark}
      aria-label={withLabel ? undefined : `Tema: ${isDark ? labels.dark : labels.light}`}
    >
      <span className={withLabel ? "" : iconSize(size)}>
        {isDark ? <Moon className={iconSize(size)} aria-hidden /> : <Sun className={iconSize(size)} aria-hidden />}
      </span>
      {withLabel && <span className="ml-2 text-sm">{isDark ? labels.dark : labels.light}</span>}
    </button>
  );
}

/* ---- estilos ---- */
function baseBtn(withLabel: boolean, size: Size) {
  const common =
    "inline-flex items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] " +
    "hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] active:scale-[.98] transition";
  if (withLabel) return `${common} min-h-11 px-3`;
  const map: Record<Size, string> = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-12 w-12" };
  return `${common} ${map[size]}`;
}
function iconSize(size: Size) {
  const map: Record<Size, string> = { sm: "h-4 w-4", md: "h-4 w-4", lg: "h-5 w-5" };
  return map[size];
}
