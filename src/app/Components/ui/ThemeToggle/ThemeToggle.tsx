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
import { useMounted } from "@/app/hooks/useMounted";
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
  useEffect(() => onThemeChange(setMode), []);

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
      title={title}
      aria-pressed={isDark}
      aria-label={withLabel ? undefined : `Tema: ${isDark ? labels.dark : labels.light}`}
    >
      <span className={withLabel ? "" : iconSize(size)}>
        {isDark ? <Sun className={iconSize(size)} /> : <Moon className={iconSize(size)} />}
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
  if (withLabel) return `${common} h-9 px-3`;
  const map: Record<Size, string> = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-10 w-10" };
  return `${common} ${map[size]}`;
}
function iconSize(size: Size) {
  const map: Record<Size, string> = { sm: "h-4 w-4", md: "h-4 w-4", lg: "h-5 w-5" };
  return map[size];
}
