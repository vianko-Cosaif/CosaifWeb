"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarClock, Camera, ChevronLeft, ChevronRight, CircleCheckBig, Eye, Gauge, ImagePlus, Loader2, MapPin, Plus, RefreshCw, Settings2, UploadCloud, Wrench, X } from "lucide-react";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";
import IncidentImagesModal from "./IncidentImagesModal";
import TornoImage from "./TornoImage";
import type { TornoImageRef, TornoLocalidadLite, TornoNavajaChange, TornoNavajaStats, TornoPagination, TornoPermissions } from "../lib/types";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const MAX_EVIDENCE_IMAGES = 3;

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeImageFiles(current: File[], incoming: File[]) {
  const map = new Map(current.map((file) => [fileKey(file), file]));
  incoming
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => map.set(fileKey(file), file));
  return Array.from(map.values()).slice(0, MAX_EVIDENCE_IMAGES);
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

function statusLabel(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "CONCLUIDO" || key === "COMPLETADO") return "CAMBIADA";
  return key || "—";
}

function formatMonth(periodo: string) {
  const [year, month] = periodo.split("-").map(Number);
  if (!year || !month) return periodo;
  return new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "");
}

export default function NavajasPanel({
  permissions,
  items,
  meta,
  stats,
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
  stats: TornoNavajaStats | null;
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
  const [formError, setFormError] = useState("");
  const [configLocalidadId, setConfigLocalidadId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [imageDialog, setImageDialog] = useState<{ title: string; images: TornoImageRef[] } | null>(null);
  const canPrev = meta.hasPrevPage ?? meta.page > 1;
  const canNext = meta.hasNextPage ?? meta.page < meta.totalPages;

  const localidadName = (id?: string | number) => {
    if (id == null || id === "") return "—";
    return localidades.find((localidad) => String(localidad.id) === String(id))?.nombre ?? String(id);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const localidadNumber = Number(localidadId);
    const navajaNumber = Number(numeroNavaja);
    if (!Number.isFinite(localidadNumber) || localidadNumber <= 0) {
      setFormError("Selecciona una localidad valida.");
      return;
    }
    if (!Number.isFinite(navajaNumber) || navajaNumber <= 0) {
      setFormError("Captura un numero de navaja valido.");
      return;
    }

    setFormError("");
    setSubmitting(true);
    try {
      await onCreate({
        localidadId: localidadNumber,
        numeroNavaja: navajaNumber,
        fechaCambio: fechaCambio ? new Date(fechaCambio).toISOString() : undefined,
        comments,
        images,
      });
      setOpen(false);
      setNumeroNavaja("");
      setFechaCambio("");
      setComments("");
      setImages([]);
      setFormError("");
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
              Historial, rotación y evidencia de mantenimiento
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
          <form onSubmit={submit} className="border-b border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">Datos del cambio</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Selecciona localidad, navaja y motivo antes de guardar.
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-black text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
                    {images.length}/3 fotos
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1fr]">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Localidad</span>
                    <select
                      value={localidadId}
                      onChange={(event) => setLocalidadId(event.target.value)}
                      required
                      className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
                    >
                      <option value="">Selecciona localidad</option>
                      {localidades.map((localidad) => (
                        <option key={String(localidad.id)} value={String(localidad.id)}>
                          {localidad.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Navaja</span>
                    <input
                      value={numeroNavaja}
                      onChange={(event) => setNumeroNavaja(event.target.value)}
                      required
                      min={1}
                      type="number"
                      placeholder="Ej. 23"
                      className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Fecha cambio</span>
                    <input
                      value={fechaCambio}
                      onChange={(event) => setFechaCambio(event.target.value)}
                      type="datetime-local"
                      className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
                    />
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Comentario</span>
                  <textarea
                    value={comments}
                    onChange={(event) => setComments(event.target.value)}
                    rows={4}
                    placeholder="Motivo del cambio, daño encontrado o comentario operativo"
                    className="mt-1 min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
                  />
                </label>

                {formError && (
                  <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                    {formError}
                  </div>
                )}
              </div>

              <NavajasEvidenceUploader images={images} onChange={setImages} disabled={submitting} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                El registro se guarda directo en el historial de navajas y las fotos quedan como evidencia.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setFormError("");
                  }}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-black text-white shadow-sm shadow-cyan-900/20 hover:bg-cyan-800 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                  Guardar cambio
                </button>
              </div>
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

      <NavajasInsights stats={stats} loading={loading} localidadName={localidadName} />

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
                        {statusLabel(item.status)}
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

                  <NavajaEvidenceButton
                    images={item.images ?? []}
                    onOpen={() =>
                      setImageDialog({
                        title: `Cambio #${item.id} · Navaja ${item.numeroNavaja ?? "—"}`,
                        images: item.images ?? [],
                      })
                    }
                  />
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="hidden max-h-[64vh] overflow-auto md:block">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.25)] dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-black">Resultado</th>
                <th className="px-4 py-3 text-left font-black">Localidad</th>
                <th className="px-4 py-3 text-left font-black">Navaja</th>
                <th className="px-4 py-3 text-left font-black">Config</th>
                <th className="px-4 py-3 text-left font-black">Fecha cambio</th>
                <th className="px-4 py-3 text-left font-black">Registro</th>
                <th className="px-4 py-3 text-left font-black">Usuario</th>
                <th className="px-4 py-3 text-left font-black">Evidencia</th>
                <th className="px-4 py-3 text-left font-black">Comentario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <NavajasEmptyState />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={String(item.id)} className="hover:bg-slate-50/90 dark:hover:bg-slate-900/70">
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black", statusClasses(item.status))}>
                        {statusLabel(item.status)}
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
                    <td className="px-4 py-3">
                      <NavajaEvidenceButton
                        images={item.images ?? []}
                        compact
                        onOpen={() =>
                          setImageDialog({
                            title: `Cambio #${item.id} · Navaja ${item.numeroNavaja ?? "—"}`,
                            images: item.images ?? [],
                          })
                        }
                      />
                    </td>
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

      <IncidentImagesModal
        open={Boolean(imageDialog)}
        title={imageDialog?.title ?? "Evidencia cambio de navajas"}
        images={imageDialog?.images ?? []}
        onClose={() => setImageDialog(null)}
      />
    </section>
  );
}

function NavajasEvidenceUploader({
  images,
  onChange,
  disabled,
}: {
  images: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const previews = useMemo(
    () => images.map((file) => ({ key: fileKey(file), file, url: URL.createObjectURL(file) })),
    [images],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const addFiles = (files: File[]) => {
    if (disabled) return;
    onChange(mergeImageFiles(images, files));
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const removeFile = (key: string) => {
    onChange(images.filter((file) => fileKey(file) !== key));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">Evidencia</h3>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Sube hasta {MAX_EVIDENCE_IMAGES} imagenes del cambio.
          </p>
        </div>
        <ImagePlus className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileInput} />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border border-dashed p-4 transition",
          dragActive
            ? "border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/30"
            : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60",
          disabled && "opacity-60",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-cyan-700 shadow-sm dark:bg-slate-950 dark:text-cyan-300">
            <UploadCloud className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">Arrastra imagenes aqui</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">o selecciona desde tu equipo</p>
          </div>
          <button
            type="button"
            disabled={disabled || images.length >= MAX_EVIDENCE_IMAGES}
            onClick={() => inputRef.current?.click()}
            className="mt-1 inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-white px-3 py-2 text-sm font-black text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-900 dark:bg-slate-950 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
          >
            <ImagePlus className="h-4 w-4" />
            Seleccionar imagenes
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {Array.from({ length: MAX_EVIDENCE_IMAGES }, (_, index) => {
          const preview = previews[index];
          return (
            <div key={preview?.key ?? `empty-${index}`} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              {preview ? (
                <>
                  <div className="h-24 bg-slate-900">
                    <TornoImage
                      src={preview.url}
                      alt={preview.file.name}
                      containerClassName="h-full w-full bg-slate-900"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="min-w-0 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {preview.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(preview.key)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      aria-label="Quitar imagen"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                  className="grid h-[134px] w-full place-items-center text-xs font-black text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  Foto {index + 1}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavajaEvidenceButton({
  images,
  onOpen,
  compact,
}: {
  images: TornoImageRef[];
  onOpen: () => void;
  compact?: boolean;
}) {
  const safeImages = images.filter((image) => image.url);
  const firstImage = safeImages[0];

  return (
    <button
      type="button"
      disabled={!safeImages.length}
      onClick={onOpen}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-55",
        compact ? "w-[168px]" : "w-full",
        safeImages.length
          ? "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200"
          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
      )}
    >
      {firstImage ? (
        <TornoImage src={firstImage.url} alt="" containerClassName="h-9 w-9 shrink-0 rounded-md bg-slate-900" className="object-cover" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white dark:bg-slate-950">
          <Camera className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black">
          {safeImages.length ? "Ver evidencia" : "Sin evidencia"}
        </span>
        <span className="block truncate text-[11px] font-semibold opacity-80">
          {safeImages.length ? `${safeImages.length} foto(s)` : "No hay fotos"}
        </span>
      </span>
      {safeImages.length ? <Eye className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}

function NavajasInsights({
  stats,
  loading,
  localidadName,
}: {
  stats: TornoNavajaStats | null;
  loading: boolean;
  localidadName: (id?: string | number) => string;
}) {
  if (loading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const top = stats.topNavajas[0];
  const maxTop = Math.max(1, ...stats.topNavajas.map((item) => item.total));
  const maxTrend = Math.max(1, ...stats.tendenciaMensual.map((item) => item.total));
  const ultimaFecha = stats.ultimaFechaCambio ? formatDate(stats.ultimaFechaCambio) : "Sin registros";

  const cards = [
    {
      label: "Cambios registrados",
      value: stats.totalCambios,
      detail: `${stats.concluidos} marcados como cambiados`,
      icon: CircleCheckBig,
      accent: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Navajas intervenidas",
      value: stats.navajasDistintas,
      detail: `${stats.coberturaNavajas}% de ${stats.navajasConfiguradas} configuradas`,
      icon: Gauge,
      accent: "text-cyan-600 dark:text-cyan-300",
    },
    {
      label: "Últimos 30 días",
      value: stats.cambiosUltimos30Dias,
      detail: `Último: ${ultimaFecha}`,
      icon: CalendarClock,
      accent: "text-violet-600 dark:text-violet-300",
    },
    {
      label: "Con evidencia",
      value: stats.conEvidencia,
      detail: `${stats.coberturaEvidencia}% de los cambios`,
      icon: Camera,
      accent: "text-amber-600 dark:text-amber-300",
    },
  ];

  return (
    <section className="space-y-3" aria-label="Indicadores de cambios de navajas">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{card.value}</p>
                </div>
                <span className="rounded-md bg-slate-50 p-2.5 dark:bg-slate-900">
                  <Icon className={cn("h-5 w-5", card.accent)} />
                </span>
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-slate-500 dark:text-slate-400" title={card.detail}>{card.detail}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-slate-100">
                <BarChart3 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                Actividad de los últimos 6 meses
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Cambios registrados por mes</p>
            </div>
          </div>
          <div className="mt-5 grid h-36 grid-cols-6 items-end gap-2" role="img" aria-label="Cambios de navajas por mes">
            {stats.tendenciaMensual.map((item) => {
              const height = item.total === 0 ? 4 : Math.max(12, Math.round((item.total / maxTrend) * 100));
              return (
                <div key={item.periodo} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">{item.total}</span>
                  <div className="flex h-24 w-full items-end rounded-md bg-slate-100 p-1 dark:bg-slate-900" title={`${item.periodo}: ${item.total} cambios`}>
                    <div className="w-full rounded bg-cyan-500 dark:bg-cyan-400" style={{ height: `${height}%` }} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-slate-500">{formatMonth(item.periodo)}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-slate-100">
              <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              Navajas con mayor rotación
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {top ? `La navaja ${top.numeroNavaja} concentra más cambios` : "Aún no hay historial"}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {stats.topNavajas.map((item) => (
              <div key={`${item.localidadId}-${item.numeroNavaja}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-black text-slate-700 dark:text-slate-200">
                    Navaja {item.numeroNavaja} · {localidadName(item.localidadId)}
                  </span>
                  <span className="shrink-0 font-black text-slate-500">{item.total} cambios</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                  <div className="h-full rounded-full bg-amber-500 dark:bg-amber-400" style={{ width: `${Math.max(8, (item.total / maxTop) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
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
