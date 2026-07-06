import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function NaturalesPagination({ loading, error, total, page, totalPages, pageSize, onPageChange }: Props) {
  if (loading || error || total === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
