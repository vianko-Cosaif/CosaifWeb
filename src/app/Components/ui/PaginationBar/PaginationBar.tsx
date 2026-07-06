"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../Button";
import { cn } from "../cn";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
};

export default function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  itemLabel = "registros",
  className,
}: PaginationBarProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <span>
        Mostrando {from}-{to} de {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
        >
          Anterior
        </Button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {safePage} / {safeTotalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          rightIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          disabled={safePage >= safeTotalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
