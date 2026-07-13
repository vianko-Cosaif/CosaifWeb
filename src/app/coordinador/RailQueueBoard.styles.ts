// RailQueueBoard.styles.ts
export const S = {
  main:
    "min-h-svh bg-[var(--app-bg)] text-[var(--app-text)] md:min-h-dvh",

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
    "sticky top-0 z-40 border-b border-[var(--app-border)] bg-[color:var(--app-surface)]/95 backdrop-blur-md pt-[env(safe-area-inset-top)]",
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
    "hidden whitespace-nowrap text-xs text-[var(--app-text-muted)] xs:inline",
  offlineChip:
    "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",

  btnBase:
    "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-150",
  btnSound: (on: boolean) =>
    `${S.btnBase} ${on
      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-subtle)]"
    }`,
  btnCommon:
    "flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-subtle)] sm:flex-none sm:py-1.5",
  btnDisabled: "disabled:opacity-50",
  btnIcon: "text-sm",
  btnLabel: "inline sm:inline",

  /* ===== LAYOUT ===== */
  section:
    "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8 pb-[env(safe-area-inset-bottom)]",
  banner:
    "mx-auto h-auto max-h-[85vh] w-full max-w-[1000px] overflow-hidden rounded-lg bg-[var(--app-surface)]",
  grid: "grid gap-4 md:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-3",

  /* ===== LEFT COLUMN ===== */
  leftCol:
    "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-[var(--app-text)] shadow-[var(--app-shadow-sm)] sm:p-5 lg:col-span-2",
  leftHeader:
    "mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
  title:
    "text-center text-xl font-bold text-[var(--app-text)] sm:text-left sm:text-2xl md:text-3xl",
  subtitle:
    "mt-1 text-center text-xs font-medium uppercase text-[var(--app-text-muted)] sm:text-left",
  refreshPill:
    "flex w-full items-center justify-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-2 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] sm:w-auto",

  currentCard:
    "min-h-[200px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 sm:p-5",
  emptyWrap: "py-12 text-center",
  emptyIcon: "mb-4 text-5xl",
  emptyTitle:
    "text-lg font-semibold text-zinc-700 dark:text-zinc-300",
  emptyDesc: "text-sm text-zinc-500 dark:text-zinc-400 mt-2",

  currentTop:
    "flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6",
  currentTopLeft: "flex items-center gap-3 sm:gap-4",
  locoBubble:
    "grid h-12 w-12 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] sm:h-14 sm:w-14",
  companyName: "mt-1 text-sm font-medium text-[var(--app-text-muted)]",
  currentTopRight: "text-left md:text-right mt-2 md:mt-0 pl-[calc(3.5rem+0.75rem)] md:pl-0",
  locoLabel: "text-xs text-[var(--app-text-muted)]",
  locoValue:
    "text-3xl font-black text-[var(--app-accent)] xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl",

  infoGrid: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4",
  infoCard:
    "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3",
  infoCardLabel:
    "flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1",
  infoCardValue:
    "text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate",
  serviceRow: "flex gap-2",

  badgeGrid: "grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6",

  detailBox:
    "rounded-lg border border-[var(--app-border)] bg-[var(--app-accent-soft)] p-4 text-[var(--app-text)]",
  detailLabel:
    "text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1",
  detailText: "text-sm font-medium",
  createdWrap: "mt-3 max-w-xs",
  instructions:
    "mt-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200",

  /* ===== RIGHT COLUMN ===== */
  aside:
    "h-fit max-h-[calc(90vh-100px)] overflow-y-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-[var(--app-text)] shadow-[var(--app-shadow-sm)]",
  asideHeader:
    "sticky top-0 z-10 mb-4 flex items-center justify-between bg-[var(--app-surface)] pb-2",
  asideTitle: "flex items-center gap-6 font-bold text-lg",
  asideCount:
    "rounded-full border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-1 text-xs text-[var(--app-text-muted)]",
  nextWrap: "space-y-4",

  nextCard:
    "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 transition-colors hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)]",
  nextHeader: "flex items-center gap-3 mb-3",
  nextIconWrap:
    "grid h-10 w-10 place-items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-accent)]",
  nextMeta: "min-w-0 flex-1",
  nextMetaLabel: "text-xs text-zinc-500 dark:text-zinc-400",
  nextMetaValue: "truncate font-bold tracking-wide text-zinc-900 dark:text-zinc-100",
  nextRight: "whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400",

  kvGrid: "grid grid-cols-2 gap-2 mb-3",
  kvBox:
    "rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-2",
  kvLabel: "text-xs text-zinc-500 dark:text-zinc-400",
  kvValue: "truncate text-sm font-medium",

  kvBoxStrong:
    "rounded-md border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-2",
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
    "rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-center",
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
    "rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs sm:text-sm",
  dateBoxLabel:
    "text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
  dateBoxValue:
    "mt-0.5 text-[11px] sm:text-xs font-medium text-zinc-800 dark:text-zinc-100",

  /* ===== MODAL ===== */
  modalOverlay:
    "fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm p-2 sm:p-4 flex items-start justify-center pt-12 sm:pt-16",
  modalCard:
    "h-auto max-h-[85vh] w-full max-w-[1000px] overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]",
  modalScroll: "h-full overflow-auto",
} as const;
