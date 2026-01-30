const TRANSITION_BASE = "transition-all duration-200 ease-in-out";
const BTN_ICON_BASE = `w-8 h-8 flex items-center justify-center rounded-full border ${TRANSITION_BASE} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black`;

// 1. CORRECCIÓN: Actualizamos los tipos para que coincidan con tu lógica de negocio
export type ToastKind = "move" | "new" | "done" | "warning" | "error" | "info";

export const S = {
  /* =========================================
     GLOBAL & LAYOUT
     ========================================= */
  Layout: {
    root: "min-h-screen bg-slate-100 dark:bg-[#050505] text-slate-900 dark:text-slate-100 font-sans pb-10 selection:bg-emerald-500/30",
    main: "max-w-[1920px] mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start",
    columnLeft: "lg:col-span-7 xl:col-span-8 flex flex-col gap-5",
    columnRight: "lg:col-span-5 xl:col-span-4 flex flex-col gap-5",
    skeleton: "h-[400px] w-full bg-white/50 dark:bg-slate-900/50 rounded-3xl animate-pulse border border-slate-200 dark:border-slate-800",
  },

  /* =========================================
     HEADER
     ========================================= */
  Header: {
    root: "sticky top-0 z-40 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-lg backdrop-saturate-150 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 h-14 md:h-16 flex items-center justify-between shadow-sm",
    left: "flex items-center gap-3",
    right: "flex items-center gap-2",
    title: "text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 leading-none tracking-tight",
    dot: "hidden xs:inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] ml-1",

    btnPolling: (polling: boolean) =>
      `${BTN_ICON_BASE} ${
        polling
          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
          : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-700"
      }`,
    pollingDot: (polling: boolean) =>
      `w-2 h-2 rounded-full ${
        polling ? "bg-emerald-500 animate-pulse shadow-sm" : "bg-slate-300 dark:bg-slate-600"
      }`,

    btnSound: (soundOn: boolean) =>
      `${BTN_ICON_BASE} ${
        soundOn
          ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
          : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500"
      }`,

    btnRefresh: `${BTN_ICON_BASE} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750`,
    refreshIcon: (refreshing: boolean) => (refreshing ? "animate-spin" : ""),

    btnEdit: `ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 ${TRANSITION_BASE}`,
  },

  /* =========================================
     CURRENT CARD (HERO)
     ========================================= */
  Card: {
    root: "group bg-white dark:bg-[#111] rounded-[2rem] border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden relative isolate",
    priorityBar: (isHigh: boolean) =>
      `h-1.5 w-full absolute top-0 left-0 z-10 ${
        isHigh 
          ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_2px_10px_rgba(239,68,68,0.5)]" 
          : "bg-gradient-to-r from-emerald-400 to-emerald-600"
      }`,
    inner: "p-5 md:p-8 space-y-6 relative z-0",
    header: "flex flex-col md:flex-row gap-5 justify-between items-start",
    headerLeft: "flex items-center gap-5 w-full",
    trainBubble: "w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-3xl md:text-4xl shadow-inner",
    infoCol: "min-w-0 flex-1 flex flex-col justify-center",
    labelSm: "text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[0.2em]",
    locoValue: "text-5xl sm:text-6xl md:text-7xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter leading-[0.9] -ml-1 py-1 drop-shadow-sm",
    company: "text-sm md:text-lg font-medium text-slate-500 dark:text-slate-400 mt-1 truncate",
    gridStats: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
    gridStatus: "grid grid-cols-2 sm:grid-cols-4 gap-3",
  },

  /* =========================================
     UPCOMING LIST (RIGHT COL)
     ========================================= */
  List: {
    header: "flex items-center justify-between px-1 mb-2",
    headerLabel: "text-xs font-bold text-slate-400 uppercase tracking-widest pl-1",
    countBadge: "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full",
    wrapper: "flex flex-col gap-3 pb-20",
    stickyHeader: "sticky top-14 z-20 py-3 bg-[#f3f4f6]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md -mx-1 px-1",
    stickyInner: "flex items-center gap-3",
    stickyChip: "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
    stickyLine: "h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-800",
    itemCard: (isHigh: boolean) =>
      `group relative bg-white dark:bg-[#121212] rounded-2xl p-4 border transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/60 hover:-translate-y-0.5 ${
        isHigh
          ? "border-red-100 dark:border-red-900/30 shadow-sm"
          : "border-slate-200 dark:border-slate-800 shadow-sm"
      }`,
    itemHighBar: "absolute left-0 top-3 bottom-3 w-1 bg-red-500 rounded-r-full",
    itemTop: "flex justify-between items-start mb-3 pl-2",
    itemBubble: "w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-lg shadow-sm text-slate-700 dark:text-slate-200",
    itemLoco: "text-2xl font-black text-slate-800 dark:text-slate-100 leading-none tabular-nums",
    itemSub: "text-[10px] text-slate-400 font-bold uppercase mt-0.5",
    itemFooter: "flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50 mt-1",
    itemDate: "text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums",
  },

  /* =========================================
     COMPONENTS & WIDGETS
     ========================================= */
  Components: {
    servicesBox: "bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-4 flex flex-col justify-center h-full",
    pill: (active: boolean) =>
      `flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition-all ${
        active
          ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
          : "bg-slate-100/50 dark:bg-slate-800/30 text-slate-400 border-transparent opacity-60 grayscale"
      }`,
    statusBox: (isHigh?: boolean) =>
      `rounded-2xl p-3 border flex flex-col items-center justify-center text-center transition-colors ${
        isHigh
          ? "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
          : "bg-white border-slate-100 dark:bg-slate-900/40 dark:border-slate-800"
      }`,
    statusValue: (isHigh?: boolean) =>
      `text-base md:text-lg font-bold tabular-nums ${
        isHigh ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
      }`,
    footerGreen: "bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 relative overflow-hidden",
    badgeBlue: "inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-900/30",
  },

  /* =========================================
     MODAL & OVERLAYS
     ========================================= */
  Modal: {
    overlay: "fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200",
    card: "bg-white dark:bg-[#121214] w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200",
    header: "px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#121214]",
    closeBtn: "w-9 h-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors",
    body: "flex-1 overflow-auto bg-slate-50/50 dark:bg-black/50 p-0",
  },

  /* =========================================
     TOASTS
     ========================================= */
  Toast: {
    wrap: "fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none",
    
    // 2. CORRECCIÓN: Actualizamos la función para manejar los nuevos tipos y colores
    item: (kind: ToastKind) => {
      let colors = "bg-slate-800 text-white border-slate-700"; // Default (info/new)

      if (kind === "move" || kind === "done") {
        colors = "bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/20";
      } else if (kind === "warning") {
        colors = "bg-amber-500 text-white border-amber-400/50 shadow-amber-500/20";
      } else if (kind === "error") {
        colors = "bg-red-500 text-white border-red-400/50 shadow-red-500/20";
      }

      return `pointer-events-auto shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 max-w-[320px] border backdrop-blur-xl text-xs font-bold animate-in slide-in-from-bottom-5 fade-in duration-300 ${colors}`;
    },
  }
} as const;