"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import HistorialTable from "./HistorialTable";
import HistorialDetailModal from "./HistorialDetailModal";
import IncidentTree from "./IncidentTree";
import NavajasPanel from "./NavajasPanel";
import { useNavajaChanges, useTornoHistory, useTornoIncidents, useTornoSession } from "../hooks/useTorno";
import { getTornoPermissions } from "../lib/permissions";
import type {
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoReopenPayload,
  TornoResolvePayload,
  TornoRole,
} from "../lib/types";

type View = "historial" | "incidentes" | "navajas";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const moduleCanvasClass =
  "relative isolate -mx-4 -mt-4 min-h-svh max-w-none overflow-x-hidden bg-[#f4f7fb] px-3 pb-6 pt-5 dark:bg-slate-950 sm:-mx-6 sm:-mt-6 sm:px-5 sm:pb-7 md:-mx-8 md:-mt-8 md:px-6 md:py-6";

export default function TornoModule({ roleHint }: { roleHint?: TornoRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useTornoSession();
  const role = roleHint ?? session.role;
  const permissions = useMemo(() => getTornoPermissions(role), [role]);

  const initialView = normalizeView(searchParams.get("view"), permissions.canViewIncidents, permissions.canViewNavajas);
  const [view, setView] = useState<View>(initialView);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    setView(normalizeView(searchParams.get("view"), permissions.canViewIncidents, permissions.canViewNavajas));
  }, [searchParams, permissions.canViewIncidents, permissions.canViewNavajas]);

  const createdById = session.user?.id;

  const historyFilters = useMemo(
    () => ({
      empresaId: role === "CLIENTE" ? session.empresaId : null,
      localidadId: role === "CLIENTE" ? session.localidadId : null,
    }),
    [role, session.empresaId, session.localidadId],
  );

  const history = useTornoHistory(historyFilters);
  const incidentFilters = useMemo(() => ({}), []);
  const incidents = useTornoIncidents({ enabled: permissions.canViewIncidents && view === "incidentes", filters: incidentFilters });
  const navajaFilters = useMemo(() => ({}), []);
  const navajas = useNavajaChanges(permissions.canViewNavajas && view === "navajas", navajaFilters);

  const showNotice = useCallback((type: "success" | "error" | "info", message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const goView = useCallback(
    (next: View) => {
      const params = new URLSearchParams();
      params.set("view", next);
      router.push(`${pathname}?${params.toString()}`);
      setView(next);
    },
    [pathname, router],
  );

  const refreshOpenDetail = useCallback(async () => {
    if (history.detail) await history.openDetail(history.detail);
  }, [history]);

  const createParent = useCallback(
    async (payload: TornoIncidentPayload) => {
      try {
        await incidents.createParent(payload);
        await refreshOpenDetail();
        showNotice("success", "Incidente guardado");
      } catch (error) {
        if (error instanceof Error && error.message === "NAVAJAS_REDIRECT") {
          goView("navajas");
          return;
        }
        showNotice("error", "No se pudo guardar el incidente");
        throw error;
      }
    },
    [goView, incidents, refreshOpenDetail, showNotice],
  );

  const editParent = useCallback(
    async (incident: TornoIncidentParent, patch: Partial<TornoIncidentPayload> & { status?: string }) => {
      try {
        await incidents.editParent(incident, { ...patch, atendidoPorId: createdById });
        await refreshOpenDetail();
        showNotice("success", "Incidente actualizado");
      } catch (error) {
        showNotice("error", "No se pudo actualizar el incidente");
        throw error;
      }
    },
    [createdById, incidents, refreshOpenDetail, showNotice],
  );

  const addChild = useCallback(
    async (parentId: string | number, payload: TornoIncidentPayload) => {
      try {
        await incidents.addChild(parentId, payload);
        await refreshOpenDetail();
        showNotice("success", "Seguimiento guardado");
      } catch (error) {
        showNotice("error", "No se pudo guardar el seguimiento");
        throw error;
      }
    },
    [incidents, refreshOpenDetail, showNotice],
  );

  const resolveParent = useCallback(
    async (incident: TornoIncidentParent, payload?: TornoResolvePayload) => {
      try {
        await incidents.resolveParent(incident, { ...payload, atendidoPorId: createdById });
        await refreshOpenDetail();
        showNotice("success", "Padre resuelto; hijos pendientes cerrados");
      } catch (error) {
        showNotice("error", "No se pudo resolver el padre");
        throw error;
      }
    },
    [createdById, incidents, refreshOpenDetail, showNotice],
  );

  const reopenParent = useCallback(
    async (incident: TornoIncidentParent, payload?: TornoReopenPayload) => {
      try {
        await incidents.reopenParent(incident, payload);
        await refreshOpenDetail();
        showNotice("success", "Incidente padre reabierto");
      } catch (error) {
        showNotice("error", "No se pudo reabrir el padre");
        throw error;
      }
    },
    [incidents, refreshOpenDetail, showNotice],
  );

  const resolveChild = useCallback(
    async (child: TornoIncidentChild, payload?: TornoResolvePayload) => {
      try {
        await incidents.resolveChild(child, payload);
        await refreshOpenDetail();
        showNotice("success", "Seguimiento resuelto");
      } catch (error) {
        showNotice("error", "No se pudo resolver el seguimiento");
        throw error;
      }
    },
    [incidents, refreshOpenDetail, showNotice],
  );

  const createNavaja = useCallback(
    async (payload: {
      localidadId?: string | number;
      numeroNavaja?: string | number;
      fechaCambio?: string;
      comments?: string;
      images?: File[];
    }) => {
      try {
        await navajas.createChange({ ...payload, creadoPorId: createdById });
        showNotice("success", "Cambio de navajas registrado");
      } catch (error) {
        showNotice("error", "No se pudo registrar Cambio de Navajas");
        throw error;
      }
    },
    [createdById, navajas, showNotice],
  );

  if (!session.mounted) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
        <div className="h-80 animate-pulse rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
      </div>
    );
  }

  const views = [
    { id: "historial" as View, label: "Historial", icon: History, show: true },
    { id: "incidentes" as View, label: "Incidentes", icon: TriangleAlert, show: permissions.canViewIncidents },
    { id: "navajas" as View, label: "Cambio de Navajas", icon: Wrench, show: permissions.canViewNavajas },
  ].filter((item) => item.show);

  if (history.detail) {
    return (
      <section className={moduleCanvasClass}>
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
          <HistorialDetailModal
            item={history.detail}
            loading={history.detailLoading}
            permissions={permissions}
            createdById={createdById}
            onClose={history.closeDetail}
            onCreateParent={permissions.canManageIncidents ? createParent : undefined}
            onEditParent={permissions.canManageIncidents ? editParent : undefined}
            onAddChild={permissions.canManageIncidents ? addChild : undefined}
          onResolveParent={permissions.canResolveParentIncident ? resolveParent : undefined}
          onReopenParent={permissions.canResolveParentIncident ? reopenParent : undefined}
          onResolveChild={permissions.canResolveChildIncident ? resolveChild : undefined}
            onNavajas={() => goView("navajas")}
          />
        </div>
      </section>
    );
  }

  return (
    <section className={moduleCanvasClass}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <header className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                  Modulo Torno
                </p>
                <h1 className="truncate text-xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-2xl">
                  {view === "historial" ? "Historial Torno" : "Operacion Torno"}
                </h1>
                <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-500 dark:text-slate-400 sm:truncate">
                  {role === "CLIENTE" ? "Consulta de historial de servicios" : "Historial, incidentes padre/hijo y cambio de navajas"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <StatusPill icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value={role} />
              <StatusPill
                label={view === "historial" ? "Servicios" : view === "incidentes" ? "Incidentes" : "Cambios"}
                value={
                  view === "historial"
                    ? String(history.meta.total || history.items.length)
                    : view === "incidentes"
                      ? String(incidents.items.length)
                      : String(navajas.meta.total || navajas.items.length)
                }
              />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/45">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <nav className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Secciones Torno">
                {views.map((item) => {
                  const active = view === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goView(item.id)}
                      className={cn(
                        "group inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black transition",
                        active
                          ? "border-cyan-600 bg-cyan-600 text-white shadow-sm shadow-cyan-900/10 dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-950"
                          : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-700",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <p className="text-xs font-semibold leading-snug text-slate-500 dark:text-slate-400">
                {view === "historial" && "Vista limpia: una tabla por estado y detalle en pantalla enfocada."}
                {view === "incidentes" && "Padres y seguimientos se gestionan sin cruzar reglas de cierre."}
                {view === "navajas" && "Cambio de Navajas mantiene su flujo fuera de incidentes."}
              </p>
            </div>
          </div>
        </header>

        {notice && (
          <div
            className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold shadow-sm",
              notice.type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
              notice.type === "error" && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
              notice.type === "info" && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
            )}
          >
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {view === "historial" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
              <div className="grid gap-2 lg:grid-cols-[minmax(260px,360px)_minmax(280px,1fr)_auto] lg:items-center">
                <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 dark:bg-slate-900">
                  {[
                    { id: "activos" as const, label: "Activos" },
                    { id: "concluidos" as const, label: "Concluidos" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => history.switchTab(tab.id)}
                      className={cn(
                        "min-h-10 rounded px-4 py-2 text-sm font-black transition",
                        history.tab === tab.id
                          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={history.filters.search ?? ""}
                    onChange={(event) => history.setSearch(event.target.value)}
                    placeholder="Buscar locomotora..."
                    className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
                  />
                </div>

                <button
                  type="button"
                  onClick={history.reload}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                  title="Actualizar"
                  aria-label="Actualizar historial Torno"
                >
                  <RefreshCw className={cn("h-4 w-4", history.refreshing && "animate-spin")} />
                  <span className="lg:hidden xl:inline">Actualizar</span>
                </button>
              </div>
            </div>

            {history.error && (
              <ErrorBlock message={history.error} onRetry={history.reload} />
            )}

            <HistorialTable
              items={history.items}
              loading={history.loading}
              refreshing={history.refreshing}
              meta={history.meta}
              onView={history.openDetail}
              onRefresh={history.reload}
              onPageChange={history.setPage}
            />
          </div>
        )}

        {view === "incidentes" && permissions.canViewIncidents && (
          <div className="space-y-4">
            {incidents.error && <ErrorBlock message={incidents.error} onRetry={incidents.reload} />}
            <IncidentTree
              incidents={incidents.items}
              loading={incidents.loading}
              meta={incidents.meta}
              permissions={permissions}
              createdById={createdById}
              onRefresh={incidents.reload}
              onPageChange={incidents.setPage}
              onCreateParent={createParent}
              onEditParent={editParent}
              onAddChild={addChild}
              onResolveParent={resolveParent}
              onReopenParent={reopenParent}
              onResolveChild={resolveChild}
              onNavajas={() => goView("navajas")}
            />
          </div>
        )}

        {view === "navajas" && permissions.canViewNavajas && (
          <div className="space-y-4">
            {navajas.error && <ErrorBlock message={navajas.error} onRetry={navajas.reload} />}
            <NavajasPanel
              permissions={permissions}
              items={navajas.items}
              meta={navajas.meta}
              loading={navajas.loading}
              refreshing={navajas.refreshing}
              localidades={navajas.localidades}
              onRefresh={navajas.reload}
              onPageChange={navajas.setPage}
              onCreate={createNavaja}
              onConfigure={navajas.configure}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeView(input: string | null, canIncidents: boolean, canNavajas: boolean): View {
  if (input === "incidentes" && canIncidents) return "incidentes";
  if (input === "navajas" && canNavajas) return "navajas";
  return "historial";
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 shadow-sm shadow-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 dark:shadow-none">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      <button type="button" onClick={onRetry} className="rounded-md border border-rose-200 bg-white px-2 py-1 font-black dark:border-rose-900 dark:bg-rose-950">
        Reintentar
      </button>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-left dark:border-slate-700 dark:bg-slate-900">
      {icon && <span className="shrink-0 text-emerald-600 dark:text-emerald-300">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase leading-none text-slate-400">{label}</span>
        <span className="mt-1 block truncate text-xs font-black uppercase text-slate-700 dark:text-slate-200">{value}</span>
      </span>
    </span>
  );
}
