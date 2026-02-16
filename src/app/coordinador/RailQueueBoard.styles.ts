// RailQueueBoard.styles.ts
export const S = {
  main:
    "min-h-svh md:min-h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",

  /* ===== TOASTS ===== */
  toastsWrap:
    "fixed z-50 flex justify-center px-3 inset-x-0 bottom-16 sm:inset-auto sm:right-2 sm:top-2 sm:bottom-auto sm:left-auto sm:px-0 md:bottom-4 md:right-4 md:top-auto",
  toastsList: "space-y-2 w-full max-w-[min(90vw,400px)]",
  toastBtn:
    "w-full text-left rounded-lg px-3 py-2.5 text-xs sm:text-sm shadow-lg border hover:scale-[1.02] transition-transform duration-150",
  toastRow: "flex items-center",
  toastIcon: "mr-2 text-base",
  toastText: "flex-1",

  /* ===== TOOLBAR ===== */
  toolbar:
    "sticky top-0 z-40 border-b border-zinc-200/60 bg-white/90 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/90 pt-[env(safe-area-inset-top)]",
  toolbarInner: "mx-auto w-full max-w-screen-2xl",
  toolbarRow:
    "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:px-4 md:px-6 md:py-2",
  toolbarLeft: "flex items-center justify-between sm:justify-start gap-2 flex-1 min-w-[150px]",
  toolbarRight: "flex items-center gap-2 flex-wrap justify-between sm:justify-end",
  toolbarButtons: "flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none justify-end",

  liveChip: (polling: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${polling
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "border-zinc-300 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    }`,
  liveDot: (polling: boolean) =>
    `inline-block h-2 w-2 rounded-full ${polling ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
    }`,
  lastUpdate:
    "hidden xs:inline text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap",
  offlineChip:
    "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",

  btnBase:
    "rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 flex items-center gap-1 hover:scale-105 active:scale-95",
  btnSound: (on: boolean) =>
    `${S.btnBase} ${on
      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "border-zinc-300 bg-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    }`,
  btnCommon:
    "rounded-lg border border-zinc-300 bg-white px-2.5 py-2 sm:py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex-1 sm:flex-none",
  btnDisabled: "disabled:opacity-50",
  btnIcon: "text-sm",
  btnLabel: "inline sm:inline",

  /* ===== LAYOUT ===== */
  section:
    "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8 pb-[env(safe-area-inset-bottom)]",
  banner:
    "mx-auto w-full max-w-[1000px] h-auto max-h-[85vh] overflow-hidden rounded-2xl bg-white ",
  grid: "grid gap-4 md:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-3",

  /* ===== LEFT COLUMN ===== */
  leftCol:
    "lg:col-span-2 rounded-2xl p-3 sm:p-6 bg-gradient-to-br from-white via-zinc-50 to-white text-zinc-900 shadow-lg border border-zinc-200 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100 dark:border-zinc-800",
  leftHeader:
    "mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
  title:
    "text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent text-center sm:text-left",
  subtitle:
    "mt-1 text-xs tracking-widest font-medium text-zinc-500 dark:text-zinc-400 uppercase text-center sm:text-left",
  refreshPill:
    "text-xs rounded-full px-4 py-2 border bg-white hover:bg-zinc-50 transition-all duration-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-zinc-600 dark:text-zinc-300 w-full sm:w-auto",

  currentCard:
    "rounded-xl bg-white p-4 sm:p-6 border shadow-sm border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 min-h-[200px]",
  emptyWrap: "py-12 text-center",
  emptyIcon: "mb-4 text-5xl",
  emptyTitle:
    "text-lg font-semibold text-zinc-700 dark:text-zinc-300",
  emptyDesc: "text-sm text-zinc-500 dark:text-zinc-400 mt-2",

  currentTop:
    "flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6",
  currentTopLeft: "flex items-center gap-3 sm:gap-4",
  locoBubble:
    "grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-gradient-to-br from-zinc-100 to-emerald-100 border border-zinc-200 dark:from-zinc-800 dark:to-zinc-700 dark:border-zinc-600 text-zinc-700 dark:text-white",
  companyName: "mt-1 text-sm text-zinc-600 dark:text-zinc-400 font-medium",
  currentTopRight: "text-left md:text-right mt-2 md:mt-0 pl-[calc(3.5rem+0.75rem)] md:pl-0",
  locoLabel: "text-xs text-zinc-500 dark:text-zinc-400",
  locoValue:
    "font-black tracking-widest bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl",

  infoGrid: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4",
  infoCard:
    "rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50",
  infoCardLabel:
    "flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1",
  infoCardValue:
    "text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate",
  serviceRow: "flex gap-2",

  badgeGrid: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6",

  detailBox:
    "rounded-xl bg-gradient-to-r from-zinc-100 to-emerald-50 text-zinc-900 p-4 border border-zinc-200 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
  detailLabel:
    "text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1",
  detailText: "text-sm font-medium",
  createdWrap: "mt-3 max-w-xs",
  instructions:
    "mt-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200",

  /* ===== RIGHT COLUMN ===== */
  aside:
    "rounded-2xl bg-white text-zinc-900 shadow-lg border border-zinc-200 p-5 sm:p-1 dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-800 h-fit max-h-[calc(90vh-100px)] overflow-y-auto",
  asideHeader:
    "mb-4 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950 pb-2 z-10",
  asideTitle: "flex items-center gap-6 font-bold text-lg",
  asideCount:
    "rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  nextWrap: "space-y-4",

  nextCard:
    "rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 transition-all duration-200 hover:bg-white hover:shadow-md hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
  nextHeader: "flex items-center gap-3 mb-3",
  nextIconWrap:
    "grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 text-zinc-700 dark:text-white",
  nextMeta: "min-w-0 flex-1",
  nextMetaLabel: "text-xs text-zinc-500 dark:text-zinc-400",
  nextMetaValue: "truncate font-bold tracking-wide text-zinc-900 dark:text-zinc-100",
  nextRight: "whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400",

  kvGrid: "grid grid-cols-2 gap-2 mb-3",
  kvBox:
    "rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950",
  kvLabel: "text-xs text-zinc-500 dark:text-zinc-400",
  kvValue: "truncate text-sm font-medium",

  kvBoxStrong:
    "rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950",
  footerRow: "flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-2",
  footerLeft: "text-xs text-zinc-500 dark:text-zinc-400",
  footerLeftVal: "font-medium text-zinc-700 dark:text-zinc-200",
  footerServices: "flex gap-1",

  nextExtra:
    "mt-3 space-y-2 text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-300",
  nextEmpty: "py-8 text-center text-sm text-zinc-500 dark:text-zinc-400",
  nextEmptyIcon: "text-3xl mb-2",

  /* ===== COMPONENT STYLES ===== */
  infoBadge:
    "rounded-lg border border-zinc-200 bg-white p-2 text-center dark:border-zinc-800 dark:bg-zinc-900",
  infoBadgeLabel:
    "flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
  infoBadgeValue:
    "mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate",

  chip: (ok: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 ${ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    }`,
  serviceChip: (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${active
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
    }`,

  dateBox:
    "rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-xs sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/60",
  dateBoxLabel:
    "text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
  dateBoxValue:
    "mt-0.5 text-[11px] sm:text-xs font-medium text-zinc-800 dark:text-zinc-100",

  /* ===== MODAL ===== */
  modalOverlay:
    "fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm p-2 sm:p-4 flex items-start justify-center pt-12 sm:pt-16",
  modalCard:
    "w-full max-w-[1000px] h-auto max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 shadow-2xl border border-zinc-200 dark:border-zinc-800",
  modalScroll: "h-full overflow-auto",
} as const;
