"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Flag, TriangleAlert } from "lucide-react";
import Nav from "@/app/Components/movimientos/Nav";
import Filtros from "@/app/Components/movimientos/Filtros";
import {
  type Ambito,
  type CampoOrden,
  type DireccionOrden,
  type FechaCampo as MovimientoFechaCampo,
  type Movement,
  type Rol,
} from "@/app/Components/movimientos/useMovimientos";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import DataEmptyState from "@/app/Components/ui/DataEmptyState";
import KpiCard from "@/app/Components/ui/KpiCard";
import ModuleHeader from "@/app/Components/ui/ModuleHeader";
import { useRealtimeBoardRefresh } from "@/app/hooks/useRealtimeBoardRefresh";
import { isTorreonNaturalEvent } from "@/features/torreon/realtime";
import { TorreonRealtimeBadge } from "@/features/torreon/components/TorreonRealtimeBadge";
import {
  TorreonNaturalRailBoard,
  useTorreonNaturales,
  type MovimientoNatural,
} from "@/features/torreon/naturales";
import { normalizeStatus } from "@/features/torreon/naturales/utils";

const Tabla = dynamic(() => import("@/app/Components/movimientos/Tabla"), {
  loading: () => <div className="min-h-[320px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />,
});

type Props = {
  localidadId: number;
  apiBase?: string;
  variant?: "summary" | "dashboard" | "movimientos";
  rol?: Extract<Rol, "ADMINISTRADOR" | "COORDINADOR">;
  onOpen?: () => void;
};

type ExtraFilters = {
  estado: string | null;
  prioridad: string | null;
  locomotiveNumber: string | null;
  campoOrden: CampoOrden;
  direccionOrden: DireccionOrden;
};

const INITIAL_EXTRA_FILTERS: ExtraFilters = {
  estado: null,
  prioridad: null,
  locomotiveNumber: null,
  campoOrden: "id",
  direccionOrden: "desc",
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapNaturalToMovement(row: MovimientoNatural, localidadId: number): Movement {
  const estado = normalizeStatus(row.estado);
  const technicalId = toNumber(row.idTecnico ?? row.id);
  const incidentes = Array.isArray(row.incidentes) ? row.incidentes : [];

  return {
    id: technicalId,
    idTecnico: technicalId,
    folioLocalidad: row.folioLocalidad ?? null,
    folioLocalidadLabel: row.folioLocalidadLabel ?? null,
    locomotora: row.locomotiveNumber ?? "S/N",
    localidadId,
    localidadNombre: "Torreón",
    localidadEstado: "Coahuila",
    viaOrigen: row.viaOrigen ?? "—",
    viaDestino: row.viaDestino ?? "—",
    tipoAccion: row.tipoMovimiento ?? "Movimiento natural",
    tipoMovimiento: row.tipoMovimiento ?? "Movimiento natural",
    prioridad: row.prioridad ?? "BAJA",
    estado,
    clienteId: toNumber(row.clienteId),
    clienteNombre: row.clienteNombre ?? row.empresaNombre ?? "—",
    supervisorId: row.supervisorId ?? null,
    supervisorNombre: row.supervisorNombre ?? "—",
    coordinadorId: row.coordinadorId ?? null,
    coordinadorNombre: row.coordinadorNombre ?? "—",
    operadorId: row.operadorId ?? null,
    operadorNombre: row.operadorNombre ?? row.iniciadoPorNombre ?? "—",
    maquinistaId: row.operadorId ?? null,
    maquinistaNombre: row.operadorNombre ?? row.iniciadoPorNombre ?? "—",
    empresaId: toNumber(row.empresaId),
    empresaNombre: row.empresaNombre ?? "Sin nombre",
    fechaSolicitud: row.fechaSolicitud ?? null,
    fechaInicio: row.fechaInicio ?? null,
    fechaFin: row.fechaFin ?? null,
    instrucciones: row.instrucciones ?? "",
    incidenteGlobal: incidentes.some((incidente) => normalizeStatus(incidente.estado) === "ABIERTO"),
    finalizado: ["CONCLUIDO", "CANCELADO"].includes(estado),
    lavado: false,
    torno: false,
    posicionCabina: "Sin_Solicitar",
    posicionChimenea: "Sin_Solicitar",
    direccionEmpuje: "Sin_Solicitar",
  };
}

function sortableValue(row: Movement, field: CampoOrden): string | number {
  if (field === "id") return row.folioLocalidad ?? row.id;
  if (field === "locomotora") return row.locomotora;
  if (field === "solicitud") return Date.parse(row.fechaSolicitud ?? "") || 0;
  if (field === "inicio") return Date.parse(row.fechaInicio ?? "") || 0;
  if (field === "fin") return Date.parse(row.fechaFin ?? "") || 0;
  if (field === "estado") return row.estado;
  if (field === "prioridad") return row.prioridad;
  if (field === "tipo") return row.tipoMovimiento;
  if (field === "localidad") return row.localidadNombre ?? "";
  return row.empresaNombre ?? "";
}

function compareMovements(a: Movement, b: Movement, field: CampoOrden, direction: DireccionOrden) {
  const left = sortableValue(a, field);
  const right = sortableValue(b, field);
  const result = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), "es-MX", { numeric: true });
  return direction === "asc" ? result : -result;
}

export default function TorreonNaturalesPanel({
  localidadId,
  apiBase,
  variant = "movimientos",
  rol = "COORDINADOR",
  onOpen,
}: Props) {
  const naturales = useTorreonNaturales(localidadId, apiBase);
  const setNaturalPage = naturales.setPage;
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [extraFilters, setExtraFilters] = useState<ExtraFilters>(INITIAL_EXTRA_FILTERS);
  const [counts, setCounts] = useState({ actuales: 0, pasados: 0 });

  const ambito: Ambito = naturales.status === "concluidos" ? "pasados" : "actuales";
  const fechaCampo: MovimientoFechaCampo = naturales.fechaCampo;

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: autoRefresh,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    matchesEvent: isTorreonNaturalEvent,
    onRefresh: ({ event }) => {
      const movimientoId = Number(event.movimientoId || 0);
      return movimientoId > 0 ? naturales.refreshById(movimientoId) : naturales.load(true);
    },
  });

  const mappedRows = useMemo(
    () => naturales.filteredRows.map((row) => mapNaturalToMovement(row, localidadId)),
    [localidadId, naturales.filteredRows]
  );

  const filteredRows = useMemo(() => {
    const selectedStates = String(extraFilters.estado ?? "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const locomotive = String(extraFilters.locomotiveNumber ?? "").trim().toLowerCase();
    const priority = String(extraFilters.prioridad ?? "").trim().toUpperCase();

    return mappedRows
      .filter((row) => !selectedStates.length || selectedStates.includes(normalizeStatus(row.estado)))
      .filter((row) => !priority || normalizeStatus(row.prioridad) === priority)
      .filter((row) => !locomotive || String(row.locomotora).toLowerCase().includes(locomotive))
      .sort((a, b) => compareMovements(a, b, extraFilters.campoOrden, extraFilters.direccionOrden));
  }, [extraFilters, mappedRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / naturales.pageSize));
  const safePage = Math.min(naturales.page, totalPages);
  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * naturales.pageSize;
    return filteredRows.slice(start, start + naturales.pageSize);
  }, [filteredRows, naturales.pageSize, safePage]);

  useEffect(() => {
    setNaturalPage(1);
  }, [extraFilters.estado, extraFilters.prioridad, extraFilters.locomotiveNumber, extraFilters.campoOrden, extraFilters.direccionOrden, setNaturalPage]);

  useEffect(() => {
    if (naturales.loading) return;
    setCounts((current) => ({ ...current, [ambito]: filteredRows.length }));
  }, [ambito, filteredRows.length, naturales.loading]);

  const changeAmbito = useCallback((next: Ambito) => {
    naturales.setStatus(next === "actuales" ? "activos" : "concluidos");
    naturales.setPage(1);
  }, [naturales]);

  const clearFilters = useCallback(() => {
    naturales.setEmpresaId(null);
    naturales.setDesde("");
    naturales.setHasta("");
    naturales.setFechaCampo("solicitud");
    naturales.setPageSize(25);
    naturales.setPage(1);
    setExtraFilters(INITIAL_EXTRA_FILTERS);
  }, [naturales]);

  if (variant === "summary") {
    const activeRows = naturales.filteredRows.filter((row) => !["CONCLUIDO", "CANCELADO"].includes(normalizeStatus(row.estado)));
    const attention = activeRows.filter((row) => ["DETENIDO", "BLOQUEADO"].includes(normalizeStatus(row.estado)) || (row.incidentes || []).some((incident) => normalizeStatus(incident.estado) === "ABIERTO")).length;
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Flag className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Operación actual</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Rondas naturales</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Locomotoras y movimientos del patio.</p>
            </div>
          </div>
          <TorreonRealtimeBadge status={realtimeStatus} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Rondas activas</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{activeRows.length}</p>
          </div>
          <div className={`rounded-xl border p-3 ${attention ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"}`}>
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              {attention ? <TriangleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden /> : null}
              Por atender
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{attention}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-emerald-700 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-300"
        >
          Ver rondas naturales
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <TorreonRealtimeBadge status={realtimeStatus} />
        </div>
        <TorreonNaturalRailBoard
          rows={naturales.filteredRows.slice(0, 8)}
          loading={naturales.loading}
          error={naturales.error}
          realtimeConnected={realtimeStatus === "connected"}
          onRefresh={() => naturales.load(true)}
        />
      </div>
    );
  }

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-slate-900/50 sm:rounded-3xl">
      <div className="flex min-w-0 flex-col gap-3 px-2 py-3 sm:gap-5 sm:px-5 sm:py-6 lg:px-7 lg:py-8">
        <ModuleHeader
          icon={Flag}
          title="Rondas naturales"
          subtitle="Seguimiento de locomotoras en Torreón"
          badge={ambito === "actuales" ? "Activas" : "Historial"}
          loading={naturales.loading}
          actions={(
            <>
              <TorreonRealtimeBadge status={realtimeStatus} />
              <div className="flex items-center gap-1.5 rounded-md bg-[var(--app-surface-muted)] px-3 py-1.5 text-xs">
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{filteredRows.length}</span>
                <span className="text-[var(--app-text-muted)]">registro{filteredRows.length === 1 ? "" : "s"}</span>
              </div>
            </>
          )}
        />

        <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent dark:via-emerald-600/30" />

        <section className="space-y-3 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-2 py-2 shadow-sm dark:border-slate-800/60 dark:from-slate-900/60 dark:to-slate-950/60 sm:rounded-2xl sm:px-4 sm:py-4">
          <Nav
            ambito={ambito}
            busqueda={naturales.search}
            autoActualizacion={autoRefresh}
            estaCargando={naturales.loading}
            contadores={counts}
            puedeCrear
            realtimeConnected={realtimeStatus === "connected"}
            onCambiarAmbito={changeAmbito}
            onBuscar={naturales.setSearch}
            onToggleAuto={setAutoRefresh}
            onRefrescar={() => naturales.load(true)}
            onNuevo={() => window.location.assign(`/movimientos/crear?localidadId=${encodeURIComponent(String(localidadId))}`)}
          />

          <Filtros
            filtros={{
              empresaId: naturales.empresaId,
              localidadId,
              desde: naturales.desde || null,
              hasta: naturales.hasta || null,
              estado: extraFilters.estado,
              prioridad: extraFilters.prioridad,
              locomotiveNumber: extraFilters.locomotiveNumber,
              fechaCampo,
              tamPagina: naturales.pageSize,
            }}
            listaEmpresas={naturales.empresas}
            listaLocalidades={[{ id: localidadId, nombre: "Torreón" }]}
            puedeElegirLocalidad={false}
            onCambiarEmpresaId={naturales.setEmpresaId}
            onCambiarLocalidadId={() => undefined}
            onCambiarRangoFechas={(desde, hasta) => {
              naturales.setDesde(desde ?? "");
              naturales.setHasta(hasta ?? "");
            }}
            onCambiarEstado={(estado) => setExtraFilters((current) => ({ ...current, estado }))}
            onCambiarPrioridad={(prioridad) => setExtraFilters((current) => ({ ...current, prioridad }))}
            onCambiarLocomotiveNumber={(locomotiveNumber) => setExtraFilters((current) => ({ ...current, locomotiveNumber }))}
            onCambiarFechaCampo={(field) => {
              naturales.setFechaCampo(field === "inicio" || field === "fin" ? field : "solicitud");
            }}
            onCambiarTamPagina={naturales.setPageSize}
            onLimpiarFiltros={clearFilters}
            deshabilitado={naturales.loading}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <KpiCard label="Total filtrado" value={filteredRows.length} compact />
            <KpiCard
              label="Orden actual"
              value={`${extraFilters.campoOrden === "id" ? "Folio" : extraFilters.campoOrden} ${extraFilters.direccionOrden === "asc" ? "ascendente" : "descendente"}`}
              compact
            />
          </div>
        </section>

        <GuidedTarget id="client-movements-list" className="flex min-h-0 flex-1 flex-col">
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white px-1 py-1.5 shadow-sm dark:border-slate-800/60 dark:bg-slate-950/80 sm:rounded-2xl sm:px-3 sm:py-3 lg:px-4 lg:py-4">
            {!filteredRows.length && !naturales.loading ? (
              <DataEmptyState
                icon={Flag}
                title={ambito === "actuales" ? "No hay rondas activas" : "No hay rondas en el historial"}
                description="Ajusta los filtros o cambia de pestaña."
                className="min-h-[320px] border-0 bg-transparent"
              />
            ) : (
              <div className="relative min-h-0 flex-1">
                <Tabla
                  filas={visibleRows}
                  pagina={safePage}
                  tamPagina={naturales.pageSize}
                  total={filteredRows.length}
                  campoOrden={extraFilters.campoOrden}
                  direccionOrden={extraFilters.direccionOrden}
                  cargando={naturales.loading}
                  rol={rol}
                  mostrarDuracion={false}
                  onPagina={naturales.setPage}
                  onOrden={(campoOrden, direccionOrden) => setExtraFilters((current) => ({ ...current, campoOrden, direccionOrden }))}
                />
              </div>
            )}
          </section>
        </GuidedTarget>
      </div>
    </section>
  );
}
