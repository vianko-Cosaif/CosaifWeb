import { statusText } from "../utils";

export function EstadoBadge({ estado }: { estado?: string | null }) {
  const normalized = statusText(estado);
  const tone = normalized.includes("BLOQUEADO") || normalized.includes("DETENIDO")
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : normalized.includes("CONCLUIDO")
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : normalized.includes("CANCELADO")
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-slate-300 bg-white text-slate-700";

  return (
    <span className={`inline-flex min-w-[92px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}
