export const S = {
  main: "min-h-svh bg-[var(--app-bg)] text-[var(--app-text)] md:min-h-dvh",
  toastsWrap:
    "fixed z-50 flex justify-center px-3 inset-x-0 bottom-16 sm:inset-auto sm:right-2 sm:top-2 sm:bottom-auto sm:left-auto sm:px-0 md:bottom-4 md:right-4 md:top-auto",
  toastsList: "space-y-2 w-full max-w-[min(90vw,400px)]",
  toastBtn:
    "w-full text-left rounded-lg px-3 py-2.5 text-xs sm:text-sm shadow-lg border hover:scale-[1.02] transition-transform duration-150",
  toastRow: "flex items-center",
  toastIcon: "mr-2 text-base",
  toastText: "flex-1",
  toolbar:
    "sticky top-0 z-40 border-b border-[var(--app-border)] bg-[color:var(--app-surface)]/95 backdrop-blur-md pt-[env(safe-area-inset-top)]",
  toolbarInner: "mx-auto w-full max-w-screen-2xl",
  toolbarRow:
    "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:px-4 md:px-6 md:py-2",
  toolbarLeft: "flex flex-wrap items-center justify-between sm:justify-start gap-2 flex-1 min-w-0",
  toolbarRight: "flex items-center gap-2 flex-wrap justify-between sm:justify-end",
  toolbarButtons: "grid grid-cols-2 items-center gap-2 flex-1 sm:flex sm:flex-none sm:justify-end",
  liveChip: (polling: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
      polling
        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "border-zinc-300 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    }`,
  liveDot: (polling: boolean) =>
    `inline-block h-2 w-2 rounded-full ${
      polling ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
    }`,
  lastUpdate: "whitespace-nowrap text-xs text-[var(--app-text-muted)]",
  offlineChip:
    "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
  btnBase:
    "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-150",
  btnSound: (on: boolean) =>
    `${S.btnBase} ${
      on
        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-subtle)]"
    }`,
  btnCommon:
    "flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-subtle)] sm:flex-none sm:py-1.5",
  btnDisabled: "disabled:opacity-50",
  btnIcon: "text-sm",
  btnLabel: "inline sm:inline",
  section:
    "mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8 pb-[env(safe-area-inset-bottom)]",
  modalOverlay:
    "fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm p-2 sm:p-4 flex items-start justify-center pt-12 sm:pt-16",
  modalCard:
    "h-auto max-h-[85vh] w-full max-w-[1000px] overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]",
  modalScroll: "h-full overflow-auto",
} as const;
