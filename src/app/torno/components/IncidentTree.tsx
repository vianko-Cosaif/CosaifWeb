"use client";

import { useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Info,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Wrench,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import IncidentImagesModal from "./IncidentImagesModal";
import type {
  TornoFailureType,
  TornoImageRef,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoPagination,
  TornoPermissions,
  TornoReopenPayload,
  TornoResolvePayload,
} from "../lib/types";

type DialogState =
  | { mode: "none" }
  | { mode: "info"; parent: TornoIncidentParent }
  | { mode: "images"; title: string; images: TornoImageRef[] }
  | { mode: "new" }
  | { mode: "edit"; parent: TornoIncidentParent }
  | { mode: "child"; parent: TornoIncidentParent }
  | { mode: "resolveParent"; parent: TornoIncidentParent }
  | { mode: "reopenParent"; parent: TornoIncidentParent }
  | { mode: "resolveChild"; child: TornoIncidentChild };

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusClasses(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "RESUELTO" || key === "CERRADO") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (key === "EN_PROCESO") {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
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

function isResolved(status?: string) {
  const key = String(status || "").toUpperCase();
  return key === "RESUELTO" || key === "CERRADO";
}

export default function IncidentTree({
  incidents,
  loading = false,
  meta,
  permissions,
  incidentContext,
  createdById,
  onRefresh,
  onPageChange,
  onCreateParent,
  onEditParent,
  onAddChild,
  onResolveParent,
  onReopenParent,
  onResolveChild,
  onNavajas,
}: {
  incidents: TornoIncidentParent[];
  loading?: boolean;
  meta?: TornoPagination;
  permissions: TornoPermissions;
  incidentContext?: Partial<TornoIncidentPayload>;
  createdById?: string | number;
  onRefresh?: () => void;
  onPageChange?: (page: number) => void;
  onCreateParent?: (payload: TornoIncidentPayload) => Promise<void>;
  onEditParent?: (
    incident: TornoIncidentParent,
    patch: Partial<TornoIncidentPayload> & { status?: string },
  ) => Promise<void>;
  onAddChild?: (parentId: string | number, payload: TornoIncidentPayload) => Promise<void>;
  onResolveParent?: (incident: TornoIncidentParent, payload?: TornoResolvePayload) => Promise<void>;
  onReopenParent?: (incident: TornoIncidentParent, payload?: TornoReopenPayload) => Promise<void>;
  onResolveChild?: (child: TornoIncidentChild, payload?: TornoResolvePayload) => Promise<void>;
  onNavajas?: () => void;
}) {
  const [dialog, setDialog] = useState<DialogState>({ mode: "none" });
  const [submitting, setSubmitting] = useState(false);

  const canMutate = permissions.canManageIncidents;
  const canPrev = Boolean(meta && (meta.hasPrevPage ?? meta.page > 1));
  const canNext = Boolean(meta && (meta.hasNextPage ?? meta.page < meta.totalPages));

  const close = () => setDialog({ mode: "none" });

  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await action();
      close();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/50">
        <div>
          <h3 className="inline-flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
            <GitBranch className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            Incidentes Torno
          </h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Padres y seguimientos separados</p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
              title="Actualizar"
              aria-label="Actualizar incidentes"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          )}
          {canMutate && onCreateParent && (
            <button
              type="button"
              onClick={() => setDialog({ mode: "new" })}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-black text-white shadow-sm hover:bg-cyan-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-100"
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 p-3">
        {loading ? (
          <div className="grid place-items-center py-10 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <MessageSquare className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">Sin incidentes registrados</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cuando exista un padre, sus seguimientos apareceran debajo.</p>
          </div>
        ) : (
          incidents.map((parent) => (
            <article key={String(parent.id)} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <div className="grid gap-3 border-l-4 border-l-cyan-500 p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black", statusClasses(parent.status))}>
                      {parent.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Fallo sistema
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{formatDate(parent.createdAt)}</span>
                  </div>
                  <h4 className="mt-2 truncate text-sm font-black text-slate-900 dark:text-slate-100">{parent.title}</h4>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{parent.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <IconButton label="Info" onClick={() => setDialog({ mode: "info", parent })} icon={<Info className="h-4 w-4" />} />
                  <IconButton
                    label="Fotos"
                    disabled={!parent.images.length}
                    onClick={() => setDialog({ mode: "images", title: "Fotos incidente padre", images: parent.images })}
                    icon={<Camera className="h-4 w-4" />}
                  />
                  {canMutate && onEditParent && (
                    <IconButton label="Editar" onClick={() => setDialog({ mode: "edit", parent })} icon={<Pencil className="h-4 w-4" />} />
                  )}
                  {canMutate && onAddChild && !isResolved(parent.status) && (
                    <IconButton label="Agregar hijo" onClick={() => setDialog({ mode: "child", parent })} icon={<Plus className="h-4 w-4" />} />
                  )}
                  {permissions.canResolveParentIncident && onResolveParent && !isResolved(parent.status) && (
                    <IconButton
                      label="Resolver padre"
                      onClick={() => setDialog({ mode: "resolveParent", parent })}
                      icon={<CheckCircle2 className="h-4 w-4" />}
                    />
                  )}
                  {permissions.canResolveParentIncident && onReopenParent && isResolved(parent.status) && (
                    <IconButton
                      label="Reabrir padre"
                      onClick={() => setDialog({ mode: "reopenParent", parent })}
                      icon={<RefreshCw className="h-4 w-4" />}
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="md:hidden">
                  {parent.children.length === 0 ? (
                    <div className="px-3 py-5 text-center text-sm font-semibold text-slate-500">
                      Sin seguimientos
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      {parent.children.map((child) => (
                        <div key={String(child.id)} className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className={cn("rounded-full border px-2 py-1 text-[11px] font-black", statusClasses(child.status))}>
                                {child.status}
                              </span>
                              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {child.description}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {formatDate(child.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <IconButton
                                label="Fotos"
                                disabled={!child.images.length}
                                onClick={() => setDialog({ mode: "images", title: "Fotos seguimiento", images: child.images })}
                                icon={<Camera className="h-4 w-4" />}
                              />
                              {permissions.canResolveChildIncident && onResolveChild && !isResolved(child.status) && (
                                <IconButton
                                  label="Resolver hijo"
                                  onClick={() => setDialog({ mode: "resolveChild", child })}
                                  icon={<CheckCircle2 className="h-4 w-4" />}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-slate-100 text-[11px] uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left font-black">Seguimiento</th>
                        <th className="px-3 py-2 text-left font-black">Estado</th>
                        <th className="px-3 py-2 text-left font-black">Fecha</th>
                        <th className="px-3 py-2 text-right font-black">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parent.children.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-5 text-center text-sm font-semibold text-slate-500">
                            Sin seguimientos
                          </td>
                        </tr>
                      ) : (
                        parent.children.map((child) => (
                          <tr key={String(child.id)}>
                            <td className="max-w-[360px] truncate px-3 py-2.5 text-left font-medium text-slate-700 dark:text-slate-300">{child.description}</td>
                            <td className="px-3 py-2 text-left">
                              <span className={cn("rounded-full border px-2 py-1 text-[11px] font-black", statusClasses(child.status))}>
                                {child.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-left text-slate-600 dark:text-slate-400">{formatDate(child.createdAt)}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex gap-2">
                                <IconButton
                                  label="Fotos"
                                  disabled={!child.images.length}
                                  onClick={() => setDialog({ mode: "images", title: "Fotos seguimiento", images: child.images })}
                                  icon={<Camera className="h-4 w-4" />}
                                />
                                {permissions.canResolveChildIncident && onResolveChild && !isResolved(child.status) && (
                                  <IconButton
                                    label="Resolver hijo"
                                    onClick={() => setDialog({ mode: "resolveChild", child })}
                                    icon={<CheckCircle2 className="h-4 w-4" />}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {meta && onPageChange && (
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
            Pagina {meta.page} de {meta.totalPages} · {meta.total} incidentes
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
      )}

      <IncidentImagesModal
        open={dialog.mode === "images"}
        title={dialog.mode === "images" ? dialog.title : ""}
        images={dialog.mode === "images" ? dialog.images : []}
        onClose={close}
      />

      {dialog.mode === "info" && <InfoModal parent={dialog.parent} onClose={close} />}

      {dialog.mode === "new" && (
        <IncidentFormModal
          title="Nuevo incidente"
          submitting={submitting}
          showFailureType
          submitLabel="Guardar"
          onClose={close}
          onSubmit={(values) =>
            run(async () => {
              if (values.failureType === "NAVAJAS") {
                onNavajas?.();
                return;
              }
              await onCreateParent?.({
                ...incidentContext,
                ...values,
                creadoPorId: createdById,
                failureType: "FALLO_SISTEMA",
              });
            })
          }
        />
      )}

      {dialog.mode === "edit" && (
        <IncidentFormModal
          title="Editar incidente padre"
          initialDescription={dialog.parent.description}
          initialComments={dialog.parent.comments}
          initialStatus={dialog.parent.status}
          submitting={submitting}
          canResolve
          submitLabel="Guardar"
          onClose={close}
          onSubmit={(values) =>
            run(async () => {
              await onEditParent?.(dialog.parent, {
                description: values.description,
                comments: values.comments,
                status: values.status,
                failureType: "FALLO_SISTEMA",
              });
            })
          }
        />
      )}

      {dialog.mode === "child" && (
        <IncidentFormModal
          title="Agregar seguimiento"
          submitting={submitting}
          submitLabel="Guardar seguimiento"
          onClose={close}
          onSubmit={(values) =>
            run(async () => {
              await onAddChild?.(dialog.parent.id, {
                ...values,
                ...incidentContext,
                parentId: dialog.parent.id,
                creadoPorId: createdById,
                failureType: "FALLO_SISTEMA",
              });
            })
          }
        />
      )}

      {dialog.mode === "resolveParent" && (
        <ResolveModal
          title="Resolver padre"
          description="Resolver el padre tambien cerrara los seguimientos pendientes."
          submitting={submitting}
          onClose={close}
          onSubmit={(payload) => run(async () => onResolveParent?.(dialog.parent, payload))}
        />
      )}

      {dialog.mode === "reopenParent" && (
        <ResolveModal
          title="Reabrir padre"
          description="El incidente padre vuelve a EN_PROCESO. Los seguimientos no se reabren automaticamente."
          submitting={submitting}
          submitLabel="Reabrir"
          tone="sky"
          onClose={close}
          onSubmit={(payload) => run(async () => onReopenParent?.(dialog.parent, payload))}
        />
      )}

      {dialog.mode === "resolveChild" && (
        <ResolveModal
          title="Resolver hijo"
          description="Esto solo resuelve el seguimiento. El incidente padre queda sin cambios."
          submitting={submitting}
          onClose={close}
          onSubmit={(payload) => run(async () => onResolveChild?.(dialog.child, payload))}
        />
      )}
    </section>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-slate-600 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
    >
      {icon}
      <span className="hidden text-xs font-black sm:inline">{label}</span>
    </button>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-3">
      <section className="max-h-[92vh] w-full overflow-hidden rounded-t-lg bg-white shadow-xl dark:bg-slate-950 sm:max-w-xl sm:rounded-lg">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[calc(92vh-56px)] overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}

function InfoModal({ parent, onClose }: { parent: TornoIncidentParent; onClose: () => void }) {
  const details = useMemo(
    () => [
      ["Estado", parent.status],
      ["Tipo", "Fallo sistema"],
      ["Creado", formatDate(parent.createdAt)],
      ["Resuelto", formatDate(parent.resolvedAt)],
      ["Usuario", parent.user || "—"],
      ["Seguimientos", String(parent.children.length)],
    ],
    [parent],
  );

  return (
    <ModalShell title="Informacion del incidente" onClose={onClose}>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-md bg-slate-50 p-2 dark:bg-slate-900">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Descripcion</div>
          <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
            {parent.description}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

function IncidentFormModal({
  title,
  initialDescription = "",
  initialComments = "",
  initialStatus = "ABIERTO",
  showFailureType = false,
  canResolve = false,
  submitting,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  initialDescription?: string;
  initialComments?: string;
  initialStatus?: string;
  showFailureType?: boolean;
  canResolve?: boolean;
  submitting: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: TornoIncidentPayload & { status?: string }) => void;
}) {
  const [failureType, setFailureType] = useState<TornoFailureType>("FALLO_SISTEMA");
  const [description, setDescription] = useState(initialDescription);
  const [comments, setComments] = useState(initialComments || "");
  const [status, setStatus] = useState(initialStatus);
  const [images, setImages] = useState<File[]>([]);

  return (
    <ModalShell title={title} onClose={onClose}>
      <form
        className="space-y-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ failureType, description, comments, images, status });
        }}
      >
        {showFailureType && (
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tipo de falla</span>
            <select
              value={failureType}
              onChange={(event) => setFailureType(event.target.value as TornoFailureType)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="FALLO_SISTEMA">Fallo sistema</option>
              <option value="NAVAJAS">Navajas</option>
            </select>
          </label>
        )}

        {canResolve && (
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Estado</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="ABIERTO">Abierto</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="RESUELTO">Resuelto</option>
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Descripcion</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Comentarios</span>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {!canResolve && (
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Imagenes</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, 3))}
              className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="mt-1 block text-xs text-slate-500">Maximo 3 imagenes</span>
          </label>
        )}

        <footer className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {failureType === "NAVAJAS" ? (
              <>
                <Wrench className="h-4 w-4" />
                Ir a Cambio de Navajas
              </>
            ) : (
              submitLabel
            )}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}

function ResolveModal({
  title,
  description,
  submitting,
  submitLabel = "Resolver",
  tone = "emerald",
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  submitting: boolean;
  submitLabel?: string;
  tone?: "emerald" | "sky";
  onClose: () => void;
  onSubmit: (payload: TornoResolvePayload) => void;
}) {
  const [comments, setComments] = useState("");
  const submitClass =
    tone === "sky"
      ? "bg-sky-600 hover:bg-sky-700"
      : "bg-emerald-600 hover:bg-emerald-700";

  return (
    <ModalShell title={title} onClose={onClose}>
      <form
        className="space-y-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ comments });
        }}
      >
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{description}</p>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Comentario</span>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <footer className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-white disabled:opacity-50 ${submitClass}`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
