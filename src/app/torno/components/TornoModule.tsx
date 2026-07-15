"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, History, ShieldCheck, TriangleAlert, Wrench, X } from "lucide-react";
import IncidentTree from "./IncidentTree";
import NavajasPanel from "./NavajasPanel";
import TornoHistoryFilters from "./TornoHistoryFilters/TornoHistoryFilters";
import TornoServiceDetail from "./TornoServiceDetail/TornoServiceDetail";
import TornoServiceTable from "./TornoServiceTable/TornoServiceTable";
import TornoSummaryCards from "./TornoSummaryCards/TornoSummaryCards";
import { useTornoController } from "../hooks/useTornoController";
import { useNavajaChanges, useTornoHistory, useTornoIncidents, useTornoSession } from "../hooks/useTorno";
import { getTornoPermissions } from "../lib/permissions";
import type { TornoRole } from "../lib/types";
import { cn } from "../lib/tornoFormat";

type View = "historial" | "incidentes" | "navajas";
type Notice = { type: "success" | "error" | "info"; message: string };
const TORNO_VIEW_STORAGE_KEY = "cosaif:torno:view";

const moduleCanvasClass =
  "relative isolate -mx-4 -mt-4 min-h-svh max-w-none overflow-x-hidden bg-[var(--app-bg)] px-3 pb-6 pt-5 sm:-mx-6 sm:-mt-6 sm:px-5 sm:pb-7 md:-mx-8 md:-mt-8 md:px-6 md:py-6";

export default function TornoModule({ roleHint }: { roleHint?: TornoRole }) {
  const searchParams = useSearchParams();
  const session = useTornoSession();
  const role = roleHint ?? session.role;
  const permissions = useMemo(() => getTornoPermissions(role), [role]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const initialView = normalizeView(
    searchParams.get("view") ?? readStoredView(),
    permissions,
  );
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (requestedView) {
      const nextView = normalizeView(requestedView, permissions);
      setView(nextView);
      storeView(nextView);
      hideSearchParam("view", searchParams);
      return;
    }

    setView((current) => normalizeView(current, permissions));
  }, [searchParams, permissions]);

  const historyFilters = useMemo(
    () => ({
      empresaId: permissions.scopeEmpresaId ? session.empresaId : null,
      localidadId: permissions.scopeLocalidadId ? session.localidadId : null,
    }),
    [permissions.scopeEmpresaId, permissions.scopeLocalidadId, session.empresaId, session.localidadId],
  );

  const history = useTornoHistory(historyFilters);
  const incidents = useTornoIncidents({ enabled: permissions.canViewIncidents && view === "incidentes" });
  const navajaFilters = useMemo(
    () => ({ localidadId: role === "COORDINADOR" ? session.localidadId : null }),
    [role, session.localidadId],
  );
  const navajas = useNavajaChanges(permissions.canViewNavajas && view === "navajas", navajaFilters);
  const createdById = session.user?.id;

  const showNotice = useCallback((type: Notice["type"], message: string) => {
    setNotice({ type, message });
    emitActivity({
      title: type === "error" ? "Accion con error" : type === "success" ? "Accion completada" : "Aviso",
      description: message,
      source: "Torno",
    });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const goView = useCallback(
    (next: View) => {
      setView(next);
      storeView(next);
      emitActivity({
        title: "Cambio de vista",
        description: `Modulo Torno: ${viewLabel(next)}`,
        source: "Torno",
      });
    },
    [],
  );

  const tornoController = useTornoController({
    history,
    incidents,
    navajas,
    createdById,
    showNotice,
  });
  const {
    refreshDetail,
    handleStartService,
    handleCancelService,
    handleStartWheel,
    handleFinishWheel,
    saveFinalMeasures,
    concludeService,
    createParent,
    editParent,
    addChild,
    resolveParent,
    reopenParent,
    resolveChild,
    createNavaja,
  } = tornoController;

  if (!session.mounted) {
    return (
      <section className={moduleCanvasClass}>
        <div className="mx-auto w-full max-w-[1500px] space-y-4">
          <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
          <div className="h-96 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
        </div>
      </section>
    );
  }

  if (history.detail) {
    return (
      <section className={moduleCanvasClass}>
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
          {notice && <NoticeBlock notice={notice} onClose={() => setNotice(null)} />}
          <TornoServiceDetail
            item={history.detail}
            loading={history.detailLoading}
            permissions={permissions}
            createdById={createdById}
            onBack={history.closeDetail}
            onRefresh={refreshDetail}
            onStartService={permissions.canOperateServices ? handleStartService : undefined}
            onCancelService={permissions.canCancelServices ? handleCancelService : undefined}
            onStartWheel={permissions.canOperateServices ? handleStartWheel : undefined}
            onFinishWheel={permissions.canOperateServices ? handleFinishWheel : undefined}
            onSaveFinalMeasures={permissions.canManageFinalMeasures ? saveFinalMeasures : undefined}
            onConcludeService={permissions.canManageFinalMeasures ? concludeService : undefined}
            onCreateParent={permissions.canManageIncidents ? createParent : undefined}
            onEditParent={permissions.canManageIncidents ? editParent : undefined}
            onAddChild={permissions.canManageIncidents ? addChild : undefined}
            onResolveParent={permissions.canResolveParentIncident ? resolveParent : undefined}
            onReopenParent={permissions.canResolveParentIncident ? reopenParent : undefined}
            onResolveChild={permissions.canResolveChildIncident ? resolveChild : undefined}
            onNavajas={() => {
              history.closeDetail();
              goView("navajas");
            }}
          />
        </div>
      </section>
    );
  }

  const views = [
    { id: "historial" as View, label: "Servicios", icon: History, show: true },
    { id: "incidentes" as View, label: "Incidentes", icon: TriangleAlert, show: permissions.canViewIncidents },
    { id: "navajas" as View, label: "Navajas", icon: Wrench, show: permissions.canViewNavajas },
  ].filter((item) => item.show);

  return (
    <section className={moduleCanvasClass}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <header className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Modulo Torno
              </p>
              <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 dark:text-slate-100">
                Control de servicios
              </h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500 dark:text-slate-400">
                Seguimiento por solicitud, ejes, medidas finales y estados reales del back.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              {role}
            </div>
          </div>
          <nav className="grid gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 sm:grid-cols-3">
            {views.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goView(item.id)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-black transition",
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-950"
                      : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-emerald-300 hover:text-[var(--app-text)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {notice && <NoticeBlock notice={notice} onClose={() => setNotice(null)} />}

        {view === "historial" && (
          <div className="space-y-4">
            <TornoHistoryFilters
              tab={history.tab}
              filters={history.filters}
              refreshing={history.refreshing}
              loading={history.loading}
              onTabChange={history.switchTab}
              onSearch={history.setSearch}
              onFiltersChange={(patch) => history.setFilters((prev) => ({ ...prev, ...patch }))}
              onRefresh={history.reload}
            />
            <TornoSummaryCards items={history.items} />
            {history.error && <ErrorBlock message={history.error} onRetry={history.reload} />}
            <TornoServiceTable
              items={history.items}
              loading={history.loading}
              refreshing={history.refreshing}
              meta={history.meta}
              canViewDurations={permissions.canViewDurations}
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
              stats={navajas.stats}
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

function normalizeView(input: string | null, permissions: { canViewIncidents: boolean; canViewNavajas: boolean }): View {
  if (input === "incidentes" && permissions.canViewIncidents) return "incidentes";
  if (input === "navajas" && permissions.canViewNavajas) return "navajas";
  return "historial";
}

function viewLabel(view: View) {
  if (view === "incidentes") return "Incidentes";
  if (view === "navajas") return "Navajas";
  return "Servicios";
}

function readStoredView() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TORNO_VIEW_STORAGE_KEY);
}

function storeView(view: View) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TORNO_VIEW_STORAGE_KEY, view);
}

function hideSearchParam(paramName: string, searchParams: ReturnType<typeof useSearchParams>) {
  if (typeof window === "undefined" || !searchParams.has(paramName)) return;
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete(paramName);
  const nextSearch = nextParams.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function emitActivity(detail: { title: string; description?: string; source?: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("cosaif:activity-event", {
      detail: {
        ...detail,
        eventId: `torno-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    }),
  );
}

function NoticeBlock({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm",
        notice.type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
        notice.type === "error" && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
        notice.type === "info" && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
      )}
    >
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 shadow-sm shadow-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 dark:shadow-none">
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
