"use client";

import { useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, ImagePlus, Loader2, MapPin, Plus, RefreshCw, Settings2, Wrench } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import type { TornoLocalidadLite, TornoNavajaChange, TornoPagination, TornoPermissions } from "../lib/types";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "COMPLETADO" || key === "CONCLUIDO" || key === "RESUELTO") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (key === "EN_PROCESO") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
}

export default function NavajasPanel({
  permissions,
  items,
  meta,
  loading,
  refreshing,
  localidades,
  onRefresh,
  onPageChange,
  onCreate,
  onConfigure,
}: {
  permissions: TornoPermissions;
  items: TornoNavajaChange[];
  meta: TornoPagination;
  loading: boolean;
  refreshing: boolean;
  localidades: TornoLocalidadLite[];
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onCreate: (payload: {
    localidadId?: string | number;
    numeroNavaja?: string | number;
    fechaCambio?: string;
    comments?: string;
    images?: File[];
  }) => Promise<void>;
  onConfigure: (payload: { localidadId?: string | number; cantidad?: string | number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [localidadId, setLocalidadId] = useState("");
  const [numeroNavaja, setNumeroNavaja] = useState("");
  const [fechaCambio, setFechaCambio] = useState("");
  const [comments, setComments] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [configLocalidadId, setConfigLocalidadId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const canPrev = meta.hasPrevPage ?? meta.page > 1;
  const canNext = meta.hasNextPage ?? meta.page < meta.totalPages;

  const localidadName = (id?: string | number) => {
    if (id == null || id === "") return "—";
    return localidades.find((localidad) => String(localidad.id) === String(id))?.nombre ?? String(id);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        localidadId: localidadId || undefined,
        numeroNavaja: numeroNavaja || undefined,
        fechaCambio: fechaCambio ? new Date(fechaCambio).toISOString() : undefined,
        comments,
        images,
      });
      setOpen(false);
      setNumeroNavaja("");
      setFechaCambio("");
      setComments("");
      setImages([]);
    } finally {
      setSubmitting(false);
    }
  };

  const submitConfig = async (event: FormEvent) => {
    event.preventDefault();
    setConfigSubmitting(true);
    try {
      await onConfigure({ localidadId: configLocalidadId || undefined, cantidad: cantidad || undefined });
      setCantidad("");
    } finally {
      setConfigSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
              <Wrench className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              Cambio de Navajas
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Flujo separado de incidentes Torno
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
              title="Actualizar"
              aria-label="Actualizar Cambio de Navajas"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
            {permissions.canManageNavajas && (
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-100"
              >
                <Plus className="h-4 w-4" />
                Registrar
              </button>
            )}
          </div>
        </div>

        {open && permissions.canManageNavajas && (
          <form onSubmit={submit} className="grid gap-3 border-b border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/30 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Localidad</span>
              <select
                value={localidadId}
                onChange={(event) => setLocalidadId(event.target.value)}
                required
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-950"
              >
                <option value="">Selecciona</option>
                {localidades.map((localidad) => (
                  <option key={String(localidad.id)} value={String(localidad.id)}>
                    {localidad.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Numero navaja</span>
              <input
                value={numeroNavaja}
                onChange={(event) => setNumeroNavaja(event.target.value)}
                required
                min={1}
                type="number"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-950"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Fecha cambio</span>
              <input
                value={fechaCambio}
                onChange={(event) => setFechaCambio(event.target.value)}
                type="datetime-local"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-950"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Imagenes</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, 3))}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <ImagePlus className="h-3.5 w-3.5" />
                Maximo 3 imagenes
              </span>
            </label>
            <label className="block lg:col-span-4">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Comentarios</span>
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-950"
              />
            </label>
            <div className="flex justify-end gap-2 lg:col-span-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        )}

        {permissions.canManageNavajas && (
          <form onSubmit={submitConfig} className="grid gap-3 p-3 lg:grid-cols-[1fr_160px_auto]">
            <label className="block">
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Settings2 className="h-3.5 w-3.5" />
                Configurar localidad
              </span>
              <select
                value={configLocalidadId}
                onChange={(event) => setConfigLocalidadId(event.target.value)}
                required
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-950"
              >
                <option value="">Selecciona</option>
                {localidades.map((localidad) => (
                  <option key={String(localidad.id)} value={String(localidad.id)}>
                    {localidad.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Cantidad</span>
              <input
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value)}
                required
                min={1}
                type="number"
                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-cyan-950"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={configSubmitting}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {configSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Configurar
              </button>
            </div>
          </form>
        )}
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div>
            <div className="text-base font-black text-slate-950 dark:text-slate-100">
              {loading ? "Cargando cambios" : `${meta.total || items.length} cambios`}
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Registros de Cambio de Navajas
            </div>
          </div>
        </div>

        <div className="md:hidden">
          {loading ? (
            <div className="grid place-items-center py-10 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <NavajasEmptyState />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => (
                <article key={String(item.id)} className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black", statusClasses(item.status))}>
                        {item.status ?? "—"}
                      </span>
                      <h3 className="mt-2 flex min-w-0 items-center gap-2 text-base font-black text-slate-950 dark:text-slate-100">
                        <MapPin className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                        <span className="truncate">{localidadName(item.localidadId)}</span>
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      Navaja {item.numeroNavaja ?? "—"}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    <NavajaFact label="Config" value={item.nava?.cantidad ? `1-${item.nava.cantidad}` : "—"} />
                    <NavajaFact label="Cambio" value={formatDate(item.fechaCambio)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
                    <NavajaFact label="Registro" value={formatDate(item.requestedAt)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
                    <NavajaFact label="Usuario" value={item.user || "—"} />
                  </div>

                  {item.comments && (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {item.comments}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="hidden max-h-[64vh] overflow-auto md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.25)] dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-black">Estado</th>
                <th className="px-4 py-3 text-left font-black">Localidad</th>
                <th className="px-4 py-3 text-left font-black">Navaja</th>
                <th className="px-4 py-3 text-left font-black">Config</th>
                <th className="px-4 py-3 text-left font-black">Fecha cambio</th>
                <th className="px-4 py-3 text-left font-black">Registro</th>
                <th className="px-4 py-3 text-left font-black">Usuario</th>
                <th className="px-4 py-3 text-left font-black">Comentario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <NavajasEmptyState />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={String(item.id)} className="hover:bg-slate-50/90 dark:hover:bg-slate-900/70">
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black", statusClasses(item.status))}>
                        {item.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900 dark:text-slate-100">
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {localidadName(item.localidadId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.numeroNavaja ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.nava?.cantidad ? `1-${item.nava.cantidad}` : "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-slate-400" />
                        {formatDate(item.fechaCambio)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(item.requestedAt)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.user || "—"}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-slate-600 dark:text-slate-300">{item.comments || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => onPageChange(meta.page - 1)}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 sm:w-fit"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-center text-xs font-black uppercase text-slate-500 dark:text-slate-400">
            Pagina {meta.page} de {meta.totalPages} · {meta.total} registros
          </span>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => onPageChange(meta.page + 1)}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 sm:ml-auto sm:w-fit"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </section>
  );
}

function NavajasEmptyState() {
  return (
    <div className="p-3 md:p-8">
      <div className="mx-auto max-w-sm rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        <Wrench className="mx-auto h-6 w-6 text-slate-400" />
        <div className="mt-2 font-bold text-slate-700 dark:text-slate-200">Sin cambios de navajas</div>
        <div className="mt-1 text-xs">Los registros apareceran aqui cuando se capturen.</div>
      </div>
    </div>
  );
}

function NavajaFact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-xs font-black text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
