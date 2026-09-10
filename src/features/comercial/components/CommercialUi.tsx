"use client";

import BaseModal from "@/components/ui/Modal";
import BaseModuleHeader from "@/components/ui/ModuleHeader";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { formatNumber, humanize } from "../lib/format";

export function ModuleHeader({ eyebrow, title, description, icon: Icon, actions }: { eyebrow: string; title: string; description: string; icon: LucideIcon; actions?: React.ReactNode }) {
  return <BaseModuleHeader icon={Icon} title={title} subtitle={description} badge={eyebrow} actions={actions}/>;
}

export function MetricCard({ icon: Icon, label, value, detail, tone = "slate" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "emerald" | "blue" | "amber" | "rose" | "slate" }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100", blue: "bg-blue-50 text-blue-900 dark:bg-blue-950/25 dark:text-blue-100", amber: "bg-amber-50 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100", rose: "bg-rose-50 text-rose-900 dark:bg-rose-950/25 dark:text-rose-100", slate: "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100" };
  return <article className={`rounded-2xl border border-[var(--app-border)] p-4 ${tones[tone]}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] opacity-80">{label}</p><p className="mt-2 break-words text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs font-bold opacity-85">{detail}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-black/15"><Icon className="h-5 w-5"/></span></div></article>;
}

export function StateBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const color = ["VIGENTE", "PAGADO", "CONCLUIDO", "APROBADO"].includes(normalized)
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200"
    : ["CANCELADO", "VENCIDO"].includes(normalized)
      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200"
      : ["DETENIDO", "PARCIAL", "EN_REVISION"].includes(normalized)
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/55 dark:text-amber-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${color}`}>{humanize(value)}</span>;
}

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  return <div className="flex flex-col gap-3 border-t border-[var(--app-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-[var(--app-text-muted)]">{formatNumber(total)} registros · Página {page} de {pages}</p><div className="flex gap-2"><button type="button" className="commercial-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}><ArrowLeft className="h-4 w-4"/>Anterior</button><button type="button" className="commercial-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente<ArrowRight className="h-4 w-4"/></button></div></div>;
}

export function LoadingPanel({ text = "Organizando información comercial…" }: { text?: string }) {
  return <section role="status" aria-live="polite" className="commercial-card grid min-h-[220px] place-items-center p-4 sm:min-h-[280px] sm:p-5"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-600 dark:text-emerald-300"/><p className="mt-3 text-sm font-black text-[var(--app-text)]">{text}</p></div></section>;
}

export function Notice({ title, text, tone = "blue" }: { title: string; text: string; tone?: "blue" | "amber" | "rose" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
    rose: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100",
  };
  return <section role={tone === "rose" ? "alert" : "status"} className={`rounded-xl border p-4 ${tones[tone]}`}><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 opacity-80">{text}</p></section>;
}

export function EmptyPanel({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-5 py-12 text-center"><p className="font-black text-[var(--app-text)]">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm text-[var(--app-text-muted)]">{text}</p></div>;
}

export function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <BaseModal title={title} onClose={onClose} bodyClassName="p-0 sm:p-0"><p className="px-5 pt-4 text-sm text-[var(--app-text-muted)]">{description}</p>{children}</BaseModal>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="commercial-label">{label}</span>{children}</label>;
}
