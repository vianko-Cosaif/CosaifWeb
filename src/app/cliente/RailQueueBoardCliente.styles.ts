/* ────────────────────────────────────────────────
   Rail Queue Board — Professional Operations UI
   Supports both light and dark mode via Tailwind dark: prefix
   ──────────────────────────────────────────────── */

const TR = "transition-all duration-150 ease-out";

export type ToastKind = "move" | "new" | "done" | "warning" | "error" | "info";

export const S = {
  /* ── LAYOUT ─────────────────────────────── */
  Layout: {
    root: "min-h-screen bg-white dark:bg-[#0e1117] text-slate-800 dark:text-slate-200 font-[Inter,system-ui,sans-serif] antialiased",
    header: [
      "sticky top-0 z-40",
      "h-12 px-4 md:px-5",
      "bg-white/90 dark:bg-[#0e1117]/95 backdrop-blur-md",
      "border-b border-slate-200 dark:border-white/[0.06]",
      "flex items-center justify-between",
    ].join(" "),
    main: "max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start",
    colLeft: "lg:col-span-7 flex flex-col gap-3",
    colRight: "lg:col-span-5 flex flex-col gap-2",
    skeleton: "h-[340px] rounded-lg bg-slate-100 dark:bg-white/[0.03] animate-pulse border border-slate-200 dark:border-white/[0.06]",
  },

  /* ── HEADER ─────────────────────────────── */
  Header: {
    left: "flex items-center gap-2.5",
    title: "text-sm font-semibold text-slate-900 dark:text-white tracking-tight",
    liveBadge: "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
    liveDot: "w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse",
    right: "flex items-center gap-1 sm:gap-2",
    btn: (active?: boolean) =>
      `h-8 w-8 inline-flex items-center justify-center rounded-md text-xs ${TR} ` +
      (active
        ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white"
        : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"),
    btnEdit: `h-8 inline-flex items-center gap-1.5 px-2 sm:px-3 rounded-md text-xs font-semibold ${TR} bg-slate-900 dark:bg-white text-white dark:text-[#0e1117] hover:bg-slate-700 dark:hover:bg-slate-200 active:scale-[0.97]`,
  },

  /* ── HERO CARD ──────────────────────────── */
  Card: {
    root: "relative rounded-lg overflow-hidden bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/[0.06] shadow-sm dark:shadow-none",
    accent: (hi: boolean) => `absolute top-0 left-0 right-0 h-[2px] ${hi ? "bg-red-500" : "bg-emerald-500"}`,
    body: "p-4 md:p-5",
    topRow: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4",
    locoWrap: "flex items-center gap-3",
    locoIcon: "w-10 h-10 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center",
    locoNum: "text-3xl sm:text-[2.5rem] font-black text-slate-900 dark:text-white tabular-nums tracking-tighter leading-none",
    locoCompany: "text-xs text-slate-500 font-medium mt-0.5",
    routeTag: "flex items-center gap-2 text-sm font-semibold bg-slate-50 dark:bg-white/[0.04] rounded-md px-3 py-1.5 border border-slate-200 dark:border-white/[0.06] self-start sm:self-auto",
    routeArrow: "text-slate-400 dark:text-slate-600",

    /* Stats — 2 cols on tiny mobile, 3 on sm+ */
    statsGrid: "grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3",
    statBox: "rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3",
    statLabel: "text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1",
    statValue: "text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums",

    /* Status chips — 2x2 grid on mobile, 4 cols on sm+ */
    statusRow: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3",
    statusChip: (color: string) =>
      `rounded-md px-2.5 py-2 text-center border ${color === "red"
        ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400"
        : color === "emerald"
          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300"
      }`,
    chipLabel: "text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5",
    chipValue: "text-sm font-bold tabular-nums truncate",

    footer: "rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3",
    footerRoute: "text-sm text-slate-600 dark:text-slate-300 mb-2 leading-relaxed",
    instrBox: "rounded-md bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/15 p-2.5 mb-2",
    instrLabel: "text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500/80 mb-1",
    instrText: "text-xs text-slate-600 dark:text-slate-400 leading-relaxed",
    dateRow: "flex items-center justify-between text-xs text-slate-500",
  },

  /* ── SERVICES ───────────────────────────── */
  Services: {
    wrap: "rounded-md bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-3 flex flex-col col-span-2 sm:col-span-1",
    label: "text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2",
    pillWrap: "flex flex-wrap gap-1.5",
    pill: (on: boolean) =>
      `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${TR} ${on
        ? "bg-slate-100 dark:bg-white/[0.06] border-slate-300 dark:border-white/[0.08] text-slate-700 dark:text-slate-300"
        : "border-transparent text-slate-400 dark:text-slate-600 opacity-50"
      }`,
  },

  /* ── QUEUE LIST ─────────────────────────── */
  List: {
    header: "flex items-center justify-between mb-2 px-0.5",
    title: "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider",
    count: "text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded tabular-nums",
    divider: "flex items-center gap-2 py-1.5",
    dividerLabel: "text-[9px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded",
    dividerLine: "h-px flex-1 bg-slate-200 dark:bg-white/[0.04]",
    card: (hi: boolean) =>
      `relative rounded-lg bg-white dark:bg-[#161b22] border p-3 ${TR} hover:bg-slate-50 dark:hover:bg-[#1c2129] shadow-sm dark:shadow-none ${hi ? "border-red-300 dark:border-red-500/30" : "border-slate-200 dark:border-white/[0.06]"
      }`,
    highBar: "absolute left-0 top-2 bottom-2 w-[2px] bg-red-500 rounded-r",
    topRow: "flex items-center justify-between mb-2",
    itemIcon: "w-7 h-7 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center",
    itemLoco: "text-base font-bold text-slate-900 dark:text-white tabular-nums tracking-tight",
    itemSub: "text-[10px] text-slate-400 dark:text-slate-500 font-medium",
    miniGrid: "grid grid-cols-2 gap-1.5 mb-2",
    miniCell: "rounded-md p-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.04]",
    miniLabel: "text-[9px] text-slate-400 dark:text-slate-600 font-semibold uppercase",
    miniValue: (bold?: boolean, color?: string) =>
      `text-xs ${bold ? "font-semibold" : "font-medium"} ${color || "text-slate-700 dark:text-slate-300"} truncate`,
    instrPreview: "text-[10px] text-slate-500 leading-relaxed line-clamp-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] rounded p-2 mb-2",
    bottom: "flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/[0.04]",
    badge: "text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/15 px-1.5 py-0.5 rounded",
    date: "text-[10px] text-slate-400 dark:text-slate-600 tabular-nums font-medium",
  },

  /* ── MODAL ──────────────────────────────── */
  Modal: {
    overlay: "fixed inset-0 z-[100] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
    card: "bg-white dark:bg-[#161b22] w-full max-w-5xl h-[90vh] rounded-lg border border-slate-200 dark:border-white/[0.06] overflow-hidden flex flex-col shadow-2xl",
    header: "px-4 py-3 border-b border-slate-200 dark:border-white/[0.06] flex justify-between items-center",
    closeBtn: "h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors",
    body: "flex-1 overflow-auto bg-slate-50 dark:bg-[#0e1117]",
  },

  /* ── TOASTS ─────────────────────────────── */
  Toast: {
    wrap: "fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none",
    item: (kind: ToastKind) => {
      const m: Record<string, string> = {
        move: "bg-emerald-600", done: "bg-emerald-600",
        new: "bg-slate-700", info: "bg-slate-700",
        warning: "bg-amber-600", error: "bg-red-600",
      };
      return `pointer-events-auto shadow-xl rounded-md px-3 py-2 flex items-center gap-2 max-w-[300px] text-xs font-medium text-white border border-white/10 ${m[kind] ?? m.info}`;
    },
  },
} as const;