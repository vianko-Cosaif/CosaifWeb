import type { ReactNode } from "react";

export function TerminalInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

export function TerminalPager({
  page,
  totalPages,
  total,
  from,
  to,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="font-mono text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        Mostrando {from}-{to} de {total}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          Anterior
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {page}/{totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          Siguiente
        </button>
      </div>
    </div>
  );
}

export function IconButton({
  title,
  tone = "default",
  disabled,
  onClick,
  children,
}: {
  title: string;
  tone?: "default" | "danger" | "warning";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClass = tone === "danger"
    ? "text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
    : tone === "warning"
      ? "text-amber-700 hover:border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
      : "text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 ${toneClass}`}
    >
      {children}
    </button>
  );
}
