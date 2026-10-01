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
      <div className="font-mono text-xs font-black uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
        Mostrando {from}-{to} de {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Anterior
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
