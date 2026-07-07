import { cn, statusLabel } from "../../lib/tornoFormat";

type Tone = "amber" | "sky" | "emerald" | "rose" | "slate";

function toneForStatus(status?: string): Tone {
  const key = String(status || "").toUpperCase();
  if (key === "SOLICITADO" || key === "PENDIENTE") return "amber";
  if (key === "EN_PROCESO") return "sky";
  if (key === "CONCLUIDO" || key === "TERMINADO") return "emerald";
  if (key === "DETENIDO" || key === "PAUSADO") return "rose";
  return "slate";
}

const classes: Record<Tone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  sky: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

const dotClasses: Record<Tone, string> = {
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export default function TornoStatusBadge({
  status,
  compact = false,
}: {
  status?: string;
  compact?: boolean;
}) {
  const tone = toneForStatus(status);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border font-black uppercase",
        compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
        classes[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />
      {statusLabel(status)}
    </span>
  );
}
