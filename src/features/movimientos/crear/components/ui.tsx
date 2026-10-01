import React from "react";
import { Movimiento } from "../../Movimiento";
import { Option } from "../../movimientos.shared";

export const inputBase =
  "w-full rounded-xl border px-3 py-3 min-h-[48px] text-base sm:text-sm outline-none transition-all duration-200 " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-200 " +
  "focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 " +
  "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:border-zinc-700 " +
  "dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20";

const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, className, id, ...rest } = props;
  const eid = id || `f_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label htmlFor={eid} className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <input
        id={eid}
        {...rest}
        aria-invalid={!!error}
        aria-describedby={error ? `${eid}_err` : undefined}
        className={Movimiento.clsx(inputBase, error && "border-rose-500 focus:border-rose-500", className)}
      />
      {error ? <span id={`${eid}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  options: Option[];
  error?: string;
  disabled?: boolean;
}) {
  const id = `sel_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label className="mb-3 block" htmlFor={id}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}_err` : undefined}
        className={Movimiento.clsx(
          inputBase,
          "bg-white dark:bg-slate-900 appearance-none touch-manipulation",
          disabled && "cursor-not-allowed opacity-60",
          error && "border-rose-500 focus:border-rose-500"
        )}
      >
        <option value="">- Selecciona -</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span id={`${id}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "error" | "muted"; children: React.ReactNode }) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
    muted: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  } as const;
  return <span className={Movimiento.clsx(chipBase, map[tone])}>{children}</span>;
}

export function RoleBadge({
  rol,
  canManageAll,
  canChooseLocality,
}: {
  rol: string;
  canManageAll: boolean;
  canChooseLocality: boolean;
}) {
  const R = String(rol || "").toUpperCase();
  const tone: "ok" | "warn" | "muted" = canManageAll ? "ok" : (R === "SUPERVISOR" ? "warn" : "muted");
  const text =
    canChooseLocality
      ? `${R} · puede elegir empresa y localidad`
      : canManageAll
        ? `${R} · puede elegir empresa · localidad asignada`
        : `${R} · solo su empresa y localidad asignada`;
  return <Badge tone={tone}>{text}</Badge>;
}
