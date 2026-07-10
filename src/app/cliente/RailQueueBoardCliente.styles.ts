/* ────────────────────────────────────────────────
   Rail Queue Board — Professional Operations UI
   Supports both light and dark mode via Tailwind dark: prefix
   ──────────────────────────────────────────────── */

import type { ToastKind } from "@/features/rail-queue";

const TR = "transition-all duration-150 ease-out";

export const S = {
  /* ── LAYOUT ─────────────────────────────── */
  Layout: {
    root: "min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] font-[Inter,system-ui,sans-serif] antialiased",
    header: [
      "sticky top-0 z-40",
      "h-12 px-4 md:px-5",
      "bg-[color:var(--app-surface)]/95 backdrop-blur-md",
      "border-b border-[var(--app-border)]",
      "flex items-center justify-between",
    ].join(" "),
    main: "max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start",
    colLeft: "lg:col-span-7 flex flex-col gap-3",
    colRight: "lg:col-span-5 flex flex-col gap-2",
    skeleton: "h-[340px] animate-pulse rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]",
  },

  /* ── HEADER ─────────────────────────────── */
  Header: {
    left: "flex items-center gap-2.5",
    title: "text-sm font-semibold text-[var(--app-text)]",
    liveBadge: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
    liveDot: "w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse",
    right: "flex items-center gap-1 sm:gap-2",
    btn: (active?: boolean) =>
      `h-8 w-8 inline-flex items-center justify-center rounded-md text-xs ${TR} ` +
      (active
        ? "bg-[var(--app-surface-muted)] text-[var(--app-text)]"
        : "text-[var(--app-text-soft)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"),
    btnEdit: `h-8 inline-flex items-center gap-1.5 px-2 sm:px-3 rounded-md text-xs font-semibold ${TR} bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-hover)] active:scale-[0.97]`,
  },

  /* ── HERO CARD ──────────────────────────── */
  Card: {
    root: "relative overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]",
    accent: (hi: boolean) => `absolute top-0 left-0 right-0 h-[2px] ${hi ? "bg-red-500" : "bg-emerald-500"}`,
    body: "p-4 md:p-5",
    topRow: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4",
    locoWrap: "flex items-center gap-3",
    locoIcon: "flex h-10 w-10 items-center justify-center rounded-md bg-[var(--app-surface-muted)]",
    locoNum: "text-3xl sm:text-[2.5rem] font-black text-[var(--app-text)] tabular-nums leading-none",
    locoCompany: "mt-0.5 text-xs font-medium text-[var(--app-text-muted)]",
    routeTag: "flex items-center gap-2 text-sm font-semibold bg-[var(--app-surface-subtle)] rounded-md px-3 py-1.5 border border-[var(--app-border)] self-start sm:self-auto",
    routeArrow: "text-slate-400 dark:text-slate-600",

    /* Stats — 2 cols on tiny mobile, 3 on sm+ */
    statsGrid: "grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3",
    statBox: "rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3",
    statLabel: "text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1",
    statValue: "text-lg sm:text-xl font-bold text-[var(--app-text)] tabular-nums",

    /* Status chips — 2x2 grid on mobile, 4 cols on sm+ */
    statusRow: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3",
    statusChip: (color: string) =>
      `rounded-md px-2.5 py-2 text-center border ${color === "red"
        ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400"
        : color === "emerald"
          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          : "bg-[var(--app-surface-subtle)] border-[var(--app-border)] text-[var(--app-text-muted)]"
      }`,
    chipLabel: "text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5",
    chipValue: "text-sm font-bold tabular-nums truncate",

    footer: "rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3",
    footerRoute: "text-sm text-slate-600 dark:text-slate-300 mb-2 leading-relaxed",
    instrBox: "rounded-md bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/15 p-2.5 mb-2",
    instrLabel: "text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500/80 mb-1",
    instrText: "text-xs text-slate-600 dark:text-slate-400 leading-relaxed",
    dateRow: "flex items-center justify-between text-xs text-slate-500",
  },

  /* ── SERVICES ───────────────────────────── */
  Services: {
    wrap: "col-span-2 flex flex-col rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 sm:col-span-1",
    label: "text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2",
    pillWrap: "flex flex-wrap gap-1.5",
    pill: (on: boolean) =>
      `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${TR} ${on
        ? "bg-[var(--app-surface-muted)] border-[var(--app-border-strong)] text-[var(--app-text-muted)]"
        : "border-transparent text-slate-400 dark:text-slate-600 opacity-50"
      }`,
  },

  /* ── QUEUE LIST ─────────────────────────── */
  List: {
    header: "flex items-center justify-between mb-2 px-0.5",
    title: "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider",
    count: "rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--app-text-muted)]",
    divider: "flex items-center gap-2 py-1.5",
    dividerLabel: "rounded bg-[var(--app-surface-muted)] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--app-text-muted)]",
    dividerLine: "h-px flex-1 bg-[var(--app-border)]",
    card: (hi: boolean) =>
      `relative rounded-lg bg-[var(--app-surface)] border p-3 ${TR} hover:bg-[var(--app-surface-subtle)] shadow-[var(--app-shadow-sm)] ${hi ? "border-red-300 dark:border-red-500/30" : "border-[var(--app-border)]"
      }`,
    highBar: "absolute left-0 top-2 bottom-2 w-[2px] bg-red-500 rounded-r",
    topRow: "flex items-center justify-between mb-2",
    itemIcon: "flex h-7 w-7 items-center justify-center rounded-md bg-[var(--app-surface-muted)]",
    itemLoco: "text-base font-bold text-[var(--app-text)] tabular-nums",
    itemSub: "text-[10px] text-slate-400 dark:text-slate-500 font-medium",
    miniGrid: "grid grid-cols-2 gap-1.5 mb-2",
    miniCell: "rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2",
    miniLabel: "text-[9px] text-slate-400 dark:text-slate-600 font-semibold uppercase",
    miniValue: (bold?: boolean, color?: string) =>
      `text-xs ${bold ? "font-semibold" : "font-medium"} ${color || "text-slate-700 dark:text-slate-300"} truncate`,
    instrPreview: "mb-2 line-clamp-2 rounded border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2 text-[10px] leading-relaxed text-[var(--app-text-muted)]",
    bottom: "flex items-center justify-between border-t border-[var(--app-border)] pt-2",
    badge: "text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/15 px-1.5 py-0.5 rounded",
    date: "text-[10px] text-slate-400 dark:text-slate-600 tabular-nums font-medium",
  },

  /* ── MODAL ──────────────────────────────── */
  Modal: {
    overlay: "fixed inset-0 z-[100] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
    card: "flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]",
    header: "flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3",
    closeBtn: "h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors",
    body: "flex-1 overflow-auto bg-[var(--app-bg)]",
  },

  /* ── TOASTS ─────────────────────────────── */
  Toast: {
    wrap: "fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none",
    item: (kind: ToastKind) => {
      const m: Record<string, string> = {
        move: "bg-emerald-600", done: "bg-emerald-600", ok: "bg-emerald-600",
        new: "bg-slate-700", info: "bg-slate-700",
        warning: "bg-amber-600", error: "bg-red-600",
      };
      return `pointer-events-auto shadow-xl rounded-md px-3 py-2 flex items-center gap-2 max-w-[300px] text-xs font-medium text-white border border-white/10 ${m[kind] ?? m.info}`;
    },
  },
} as const;
