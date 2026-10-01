import { type PanelData, type MovementStatus, type MovementType, type HeaderEventTone } from "./types";

export const EMPTY_DATA: PanelData = { incidents: [], movements: [], torneados: [] };

export const statusTone = {
  DETENIDO: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200",
  "EN PROCESO": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-200",
  SOLICITADO: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  "EN COLA": "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  "EN ESPERA": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200",
} satisfies Record<MovementStatus, string>;

export const movementTypeTone = {
  Torno: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200",
  Lavado: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200",
  Normal: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200",
} satisfies Record<MovementType, string>;

export const rowTypeTone = {
  Normal: "border-emerald-200/90 bg-[linear-gradient(90deg,rgba(209,250,229,.92),rgba(236,253,245,.70))] dark:border-emerald-900/65 dark:bg-[linear-gradient(90deg,rgba(6,78,59,.46),rgba(6,95,70,.16))]",
  Torno: "border-rose-200/90 bg-[linear-gradient(90deg,rgba(254,226,226,.94),rgba(255,241,242,.72))] dark:border-rose-900/70 dark:bg-[linear-gradient(90deg,rgba(76,5,25,.55),rgba(127,29,29,.20))]",
  Lavado: "border-sky-200/90 bg-[linear-gradient(90deg,rgba(224,242,254,.94),rgba(240,249,255,.72))] dark:border-sky-900/70 dark:bg-[linear-gradient(90deg,rgba(8,47,73,.56),rgba(12,74,110,.18))]",
} satisfies Record<MovementType, string>;

export const rowTypeAccentTone = {
  Normal: "before:bg-emerald-500",
  Torno: "before:bg-rose-500",
  Lavado: "before:bg-sky-500",
} satisfies Record<MovementType, string>;

export function activeServiceTone(type: MovementType) {
  if (type === "Torno") {
    return {
      className: "border-rose-300/90 bg-[linear-gradient(90deg,rgba(255,228,230,.98),rgba(255,241,242,.80))] dark:border-rose-800/80 dark:bg-[linear-gradient(90deg,rgba(76,5,25,.74),rgba(127,29,29,.28))]",
      ring: "ring-2 ring-rose-300/80 dark:ring-rose-700/75",
      shadow: "0 12px 30px rgba(225,29,72,0.20)",
      shadowPulse: ["0 0 0 1px rgba(225,29,72,.10),0 5px 14px rgba(225,29,72,.08)", "0 0 0 2px rgba(225,29,72,.28),0 8px 22px rgba(225,29,72,.22)", "0 0 0 1px rgba(225,29,72,.10),0 5px 14px rgba(225,29,72,.08)"],
      bar: "bg-rose-500 shadow-[0_0_16px_rgba(225,29,72,.55)]",
      dot: "bg-rose-600 dark:bg-rose-300",
      text: "text-rose-700 dark:text-rose-200",
    };
  }

  if (type === "Lavado") {
    return {
      className: "border-sky-300/90 bg-[linear-gradient(90deg,rgba(224,242,254,.98),rgba(240,249,255,.80))] dark:border-sky-800/80 dark:bg-[linear-gradient(90deg,rgba(8,47,73,.74),rgba(12,74,110,.28))]",
      ring: "ring-2 ring-sky-300/80 dark:ring-sky-700/75",
      shadow: "0 12px 30px rgba(14,165,233,0.20)",
      shadowPulse: ["0 0 0 1px rgba(14,165,233,.10),0 5px 14px rgba(14,165,233,.08)", "0 0 0 2px rgba(14,165,233,.28),0 8px 22px rgba(14,165,233,.22)", "0 0 0 1px rgba(14,165,233,.10),0 5px 14px rgba(14,165,233,.08)"],
      bar: "bg-sky-500 shadow-[0_0_16px_rgba(14,165,233,.55)]",
      dot: "bg-sky-600 dark:bg-sky-300",
      text: "text-sky-700 dark:text-sky-200",
    };
  }

  return {
    className: "border-emerald-300/90 bg-[linear-gradient(90deg,rgba(209,250,229,.98),rgba(236,253,245,.80))] dark:border-emerald-800/80 dark:bg-[linear-gradient(90deg,rgba(6,78,59,.74),rgba(6,95,70,.28))]",
    ring: "ring-2 ring-emerald-300/80 dark:ring-emerald-700/75",
    shadow: "0 12px 30px rgba(16,185,129,0.20)",
    shadowPulse: ["0 0 0 1px rgba(16,185,129,.10),0 5px 14px rgba(16,185,129,.08)", "0 0 0 2px rgba(16,185,129,.28),0 8px 22px rgba(16,185,129,.22)", "0 0 0 1px rgba(16,185,129,.10),0 5px 14px rgba(16,185,129,.08)"],
    bar: "bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,.55)]",
    dot: "bg-emerald-600 dark:bg-emerald-300",
    text: "text-emerald-700 dark:text-emerald-200",
  };
}

export const tickerTone = {
  incident: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200",
  movement: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200",
  torno: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-200",
  lavado: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200",
  state: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200",
} satisfies Record<HeaderEventTone, string>;

export function panelClass(extra = "") {
  return `rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_18px_50px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)] ${extra}`;
}

export const RIGHT_PANEL_ROTATION_MS = 20_000;

export const KPI_PANEL_ROTATION_MS = 20_000;

export const panelEase = [0.22, 1, 0.36, 1] as const;

export const panelEaseIn = [0.4, 0, 1, 1] as const;

export const panelMotion = {
  header: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: panelEase },
  },
  left: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, delay: 0.1, ease: panelEase },
  },
  center: {
    initial: { opacity: 0, scale: 0.965 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.42, delay: 0.16, ease: panelEase },
  },
  right: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, delay: 0.18, ease: panelEase },
  },
};

export const listContainerMotion = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

export const listItemMotion = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.26, ease: panelEase } },
  exit: { opacity: 0, x: 18, scale: 0.98, transition: { duration: 0.18, ease: panelEaseIn } },
};
