// src/app/Components/ui/EmptyState.tsx
"use client";

import React from "react";
import Link from "next/link";

type Size = "sm" | "md" | "lg";
type Variant = "primary" | "secondary" | "ghost";

export type EmptyAction = {
  label: string;
  href?: string;              // si se pasa, renderiza <Link>
  onClick?: () => void;       // si no hay href, usa <button>
  icon?: React.ReactNode;
  variant?: Variant;
  className?: string;
  "aria-label"?: string;
};

export interface EmptyStateProps {
  title?: string;
  description?: string | React.ReactNode;
  icon?: React.ReactNode;       // e.g. <Inbox className="h-8 w-8" />
  illustration?: React.ReactNode; // slot para imágenes/ilustraciones
  actions?: EmptyAction[];      // botones (máx. 2–3 idealmente)
  size?: Size;                  // controla paddings/tipografías
  centered?: boolean;           // centra verticalmente dentro del contenedor
  className?: string;           // clases extra del wrapper
  children?: React.ReactNode;   // contenido adicional (chips, tips, etc)
}

export default function EmptyState({
  title = "Nada por aquí…",
  description = "No hay datos que mostrar todavía.",
  icon,
  illustration,
  actions = [],
  size = "md",
  centered = true,
  className = "",
  children,
}: EmptyStateProps) {
  const S = SIZES[size];

  return (
    <section
      className={[
        "rounded-2xl border bg-white/80 p-6 shadow-sm backdrop-blur-sm",
        "border-slate-200 dark:border-slate-700",
        "dark:bg-slate-900/70",
        centered ? "grid place-items-center min-h-[260px]" : "",
        className,
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className={["flex w-full max-w-xl flex-col items-center text-center", S.stackGap].join(" ")}>
        {/* Ilustración o icono */}
        {illustration ? (
          <div className={["select-none", S.illu].join(" ")} aria-hidden>
            {illustration}
          </div>
        ) : icon ? (
          <div
            className={[
              "grid place-items-center rounded-full border",
              "border-slate-200 bg-slate-50 text-slate-600",
              "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
              S.iconWrap,
            ].join(" ")}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}

        {/* Texto */}
        <div className="space-y-1">
          <h2 className={["font-semibold text-slate-900 dark:text-slate-100", S.title].join(" ")}>{title}</h2>
          {description ? (
            <p className={["text-slate-600 dark:text-slate-300", S.desc].join(" ")}>{description}</p>
          ) : null}
        </div>

        {/* Extra (chips, tips) */}
        {children ? <div className="text-slate-500 dark:text-slate-400">{children}</div> : null}

        {/* Acciones */}
        {actions.length > 0 ? (
          <div className={["flex flex-wrap items-center justify-center gap-2", S.actionsGap].join(" ")}>
            {actions.map((a, i) =>
              a.href ? (
                <Link
                  key={i}
                  href={a.href}
                  className={[btnBase, btnVariant(a.variant ?? (i === 0 ? "primary" : "secondary")), a.className || "", S.btn].join(" ")}
                  aria-label={a["aria-label"] ?? a.label}
                >
                  {a.icon ? <span className="mr-2 inline-flex">{a.icon}</span> : null}
                  {a.label}
                </Link>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  className={[btnBase, btnVariant(a.variant ?? (i === 0 ? "primary" : "secondary")), a.className || "", S.btn].join(" ")}
                  aria-label={a["aria-label"] ?? a.label}
                >
                  {a.icon ? <span className="mr-2 inline-flex">{a.icon}</span> : null}
                  {a.label}
                </button>
              )
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- estilos ---------- */
const btnBase =
  "inline-flex items-center justify-center rounded-md border font-medium transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60";

function btnVariant(v: Variant): string {
  switch (v) {
    case "primary":
      return [
        "border-sky-600 bg-sky-600 text-white hover:bg-sky-700",
        "dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600",
      ].join(" ");
    case "secondary":
      return [
        "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      ].join(" ");
    case "ghost":
    default:
      return [
        "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
        "dark:text-slate-200 dark:hover:bg-slate-800",
      ].join(" ");
  }
}

const SIZES: Record<Size, { title: string; desc: string; btn: string; iconWrap: string; illu: string; stackGap: string; actionsGap: string }> = {
  sm: {
    title: "text-base",
    desc: "text-xs",
    btn: "h-8 px-3 text-sm",
    iconWrap: "h-10 w-10 text-base",
    illu: "max-w-[180px] mb-1",
    stackGap: "gap-2",
    actionsGap: "gap-2",
  },
  md: {
    title: "text-lg",
    desc: "text-sm",
    btn: "h-9 px-4 text-sm",
    iconWrap: "h-12 w-12 text-lg",
    illu: "max-w-[220px] mb-2",
    stackGap: "gap-3",
    actionsGap: "gap-2.5",
  },
  lg: {
    title: "text-xl",
    desc: "text-base",
    btn: "h-10 px-5 text-base",
    iconWrap: "h-14 w-14 text-xl",
    illu: "max-w-[280px] mb-3",
    stackGap: "gap-4",
    actionsGap: "gap-3",
  },
};
