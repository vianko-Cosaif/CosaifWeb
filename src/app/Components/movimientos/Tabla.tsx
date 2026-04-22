"use client";

import React,
{
  useState,
  useMemo,
  useCallback,
  memo,
  Fragment,
} from "react";
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Loader2,
  TrainFront,
  MapPin,
  Building2,
  CalendarClock,
  Hash,
  Info,
  Activity,
  CheckCircle2,
  User,
  Flag,
  Settings,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit3,
} from "lucide-react";
import styles from "./Tabla.module.scss";
import type { Movement, CampoOrden, DireccionOrden } from "./useMovimientos";
import TornoMeasuresViewerModal from "../../movimientos/torno/TornoMeasuresViewerModal";
import { parseTornoMedicionFromApi } from "../../movimientos/torno/tornoMeasureParser";
import { DEFAULT_TORNO_MEDICION_STATE, type TornoMedicionState } from "../../movimientos/crear/tornoMedicion.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";

/* --- PROPS --- */
interface TablaProps {
  filas: Movement[];
  pagina: number;
  tamPagina: number;
  total: number;
  totalEstimado?: boolean;
  campoOrden: CampoOrden;
  direccionOrden: DireccionOrden;
  cargando?: boolean;
  onPagina: (p: number) => void;
  onOrden: (c: CampoOrden, d: DireccionOrden) => void;
  onEditar?: (id: number) => void;
}

type MeasuresModalState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  tornoMedicion: TornoMedicionState;
  locomotiveLabel?: string;
  companyName?: string;
};

/* ================== CONSTANTES UI ================== */

const BADGE_ESTADO: Record<string, { bg: string; dot: string; text: string }> = {
  SOLICITADO: {
    bg: "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-400",
  },
  EN_PROCESO: {
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-700 dark:text-amber-400",
  },
  CONCLUIDO: {
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  CANCELADO: {
    bg: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
  },
  DETENIDO: {
    bg: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
};

const DEFAULT_BADGE = {
  bg: "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
  dot: "bg-slate-400",
  text: "text-slate-600 dark:text-slate-400",
};

/* ================== COMPONENTE PRINCIPAL ================== */

function TablaInner({
  filas,
  pagina,
  tamPagina,
  total,
  totalEstimado = false,
  campoOrden,
  direccionOrden,
  cargando,
  onPagina,
  onOrden,
  onEditar,
}: TablaProps) {
  const NO_EDIT_STATES = useMemo(
    () => new Set(["DETENIDO", "EN_PROCESO", "CONCLUIDO"]),
    []
  );
  const puedeEditarMovimiento = useCallback(
    (estado?: string) => {
      const key = String(estado || "").trim().toUpperCase();
      return key ? !NO_EDIT_STATES.has(key) : true;
    },
    [NO_EDIT_STATES]
  );
  const showEditColumn = Boolean(onEditar) && filas.some((m) => puedeEditarMovimiento(m.estado));
  const showMeasuresColumn = false;
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [measuresModal, setMeasuresModal] = useState<MeasuresModalState>({
    open: false,
    loading: false,
    error: null,
    tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
  });

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / tamPagina)),
    [total, tamPagina]
  );

  const tieneFilas = filas.length > 0;

  const startIndex = useMemo(
    () => (total === 0 ? 0 : (pagina - 1) * tamPagina + 1),
    [pagina, tamPagina, total]
  );
  const endIndex = useMemo(
    () => (total === 0 ? 0 : startIndex + filas.length - 1),
    [startIndex, filas.length, total]
  );

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handlePrevPage = useCallback(() => {
    if (pagina > 1) onPagina(pagina - 1);
  }, [pagina, onPagina]);

  const handleNextPage = useCallback(() => {
    if (pagina < totalPaginas) onPagina(pagina + 1);
  }, [pagina, totalPaginas, onPagina]);

  const closeMeasuresModal = useCallback(() => {
    setMeasuresModal((prev) => ({ ...prev, open: false, error: null }));
  }, []);

  const handleViewMeasures = useCallback(async (movement: Movement) => {
    const movementId = Number(movement.id);
    if (!Number.isFinite(movementId) || movementId <= 0) return;

    setMeasuresModal({
      open: true,
      loading: true,
      error: null,
      tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
      locomotiveLabel: String(movement.locomotora ?? ""),
      companyName: movement.empresaNombre,
    });

    try {
      const response = await fetch(`${API_BASE}/movimientos/${movementId}/edicion`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`No se pudo cargar medidas (${response.status}).`);
      }
      const payload = await response.json();
      const parsed = parseTornoMedicionFromApi(payload);
      setMeasuresModal((prev) => ({
        ...prev,
        loading: false,
        tornoMedicion: parsed,
        locomotiveLabel: String(payload?.movimiento?.locomotiveNumber ?? movement.locomotora ?? ""),
        companyName: payload?.movimiento?.empresa?.nombre ?? movement.empresaNombre,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron cargar las medidas.";
      setMeasuresModal((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  /* Page pills */
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) pages.push(i);
    } else {
      pages.push(1);
      if (pagina > 3) pages.push("...");
      const start = Math.max(2, pagina - 1);
      const end = Math.min(totalPaginas - 1, pagina + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (pagina < totalPaginas - 2) pages.push("...");
      pages.push(totalPaginas);
    }
    return pages;
  }, [pagina, totalPaginas]);

  return (
    <div className="flex h-full w-full flex-col space-y-3 sm:space-y-4 font-sans">
      <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/95 shadow-sm transition-all">
        {/* Loader Overlay */}
        {cargando && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-slate-950/60">
            <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 py-2.5 sm:py-3.5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="animate-spin text-emerald-600" size={20} />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Sincronizando...
              </span>
            </div>
          </div>
        )}

        {/* Mobile/Tablet cards */}
        <div className="xl:hidden px-2 py-3 space-y-3">
          {!tieneFilas ? (
            <div className="py-10 text-center">
              <div className="mx-auto w-fit rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                <TrainFront size={34} strokeWidth={1.2} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                No hay movimientos registrados
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Ajusta filtros o cambia de pestaña
              </p>
            </div>
          ) : (
            filas.map((movement) => (
              <MobileCard
                key={movement.id}
                movement={movement}
                isOpen={Boolean(expanded[movement.id])}
                onToggle={toggle}
                onEditar={onEditar}
                showEdit={showEditColumn}
                canEdit={puedeEditarMovimiento(movement.estado)}
                showMeasures={showMeasuresColumn}
                onViewMeasures={handleViewMeasures}
              />
            ))
          )}
        </div>

        {/* Tabla (desktop) */}
        <div className={`hidden xl:block w-full overflow-x-auto ${styles.tableContainer}`}>
          <table className="w-full border-collapse text-left">
            {/* HEADER */}
            <thead
              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${styles.glassHeader}`}
            >
              <tr>
                <th className="hidden sm:table-cell w-10 px-2 py-3 text-center sm:w-12 sm:px-4 sm:py-4">
                  #
                </th>
                <HeaderCell
                  label="ID"
                  sortKey="id"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={Hash}
                />
                <HeaderCell
                  label="Locomotora"
                  sortKey="locomotora"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={TrainFront}
                />

                <HeaderCell
                  label="Localidad"
                  sortKey="localidad"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={MapPin}
                  className="hidden md:table-cell"
                />
                <HeaderCell
                  label="Empresa"
                  sortKey="empresa"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={Building2}
                  className="hidden md:table-cell"
                />
                <HeaderCell
                  label="Solicitud"
                  sortKey="solicitud"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={CalendarClock}
                  className="hidden lg:table-cell"
                />
                <HeaderCell
                  label="Inicio"
                  sortKey="inicio"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={CalendarClock}
                  className="hidden xl:table-cell"
                />
                <HeaderCell
                  label="Fin"
                  sortKey="fin"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={CalendarClock}
                  className="hidden xl:table-cell"
                />

                <HeaderCell
                  label="Estado"
                  sortKey="estado"
                  currentSort={campoOrden}
                  dir={direccionOrden}
                  onSort={onOrden}
                  icon={Activity}
                  align="center"
                />

                {showEditColumn && (
                  <th className="px-2 py-3 text-center sm:px-4 sm:py-4">
                    Editar
                  </th>
                )}
                {showMeasuresColumn && (
                  <th className="px-2 py-3 text-center sm:px-4 sm:py-4">
                    Medidas
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs sm:text-xs md:text-sm">
              {!tieneFilas ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center sm:py-20">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                        <TrainFront size={36} strokeWidth={1.2} className="text-slate-300 dark:text-slate-600" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-slate-500 dark:text-slate-400">
                          No hay movimientos registrados
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          Los movimientos aparecerán aquí cuando estén disponibles
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filas.map((movement) => (
                  <MovimientoRow
                    key={movement.id}
                    movement={movement}
                    isOpen={Boolean(expanded[movement.id])}
                    onToggle={toggle}
                    onEditar={onEditar}
                    showEdit={showEditColumn}
                    canEdit={puedeEditarMovimiento(movement.estado)}
                    showMeasures={showMeasuresColumn}
                    onViewMeasures={handleViewMeasures}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con page pills */}
        <div className="flex flex-col items-center justify-between gap-3 sm:gap-4 rounded-b-xl sm:rounded-b-2xl border-t border-slate-200 dark:border-slate-800/60 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/60 p-2.5 sm:p-3 text-[10px] sm:flex-row sm:p-4 sm:text-xs">
          <p className="order-2 font-medium text-slate-500 dark:text-slate-400 sm:order-1">
            {total === 0 ? (
              "Sin registros"
            ) : (
              <>
                Mostrando{" "}
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {startIndex}
                </span>{" "}
                –{" "}
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {endIndex}
                </span>{" "}
                de{" "}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {total}
                  {totalEstimado ? "+" : ""}
                </span>
              </>
            )}
          </p>

          <div className="order-1 flex items-center gap-1 sm:order-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={pagina <= 1}
              className="rounded-lg border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80 p-2 text-slate-500 dark:text-slate-400 shadow-sm transition-all hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page pills */}
            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 dark:text-slate-500 select-none">
                  ···
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPagina(p)}
                  className={`min-w-[1.75rem] sm:min-w-[2rem] h-7 sm:h-8 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-200 active:scale-95 ${p === pagina
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:bg-slate-800/80 dark:border-slate-700/60 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                    }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              onClick={handleNextPage}
              disabled={pagina >= totalPaginas}
              className="rounded-lg border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80 p-2 text-slate-500 dark:text-slate-400 shadow-sm transition-all hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <TornoMeasuresViewerModal
        open={measuresModal.open && !measuresModal.loading && !measuresModal.error}
        onClose={closeMeasuresModal}
        tornoMedicion={measuresModal.tornoMedicion}
        locomotiveLabel={measuresModal.locomotiveLabel}
        companyName={measuresModal.companyName}
      />
      {measuresModal.open && (measuresModal.loading || measuresModal.error) ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {measuresModal.loading ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">Cargando medidas de torno...</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-rose-600 dark:text-rose-300">{measuresModal.error}</p>
                <button
                  type="button"
                  onClick={closeMeasuresModal}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(TablaInner);

/* ================== FILA (MEMOIZADA) ================== */

interface MovimientoRowProps {
  movement: Movement;
  isOpen: boolean;
  onToggle: (id: number) => void;
  onEditar?: (id: number) => void;
  showEdit?: boolean;
  canEdit?: boolean;
  showMeasures?: boolean;
  onViewMeasures?: (movement: Movement) => void;
}

const MovimientoRow = memo(function MovimientoRow({
  movement,
  isOpen,
  onToggle,
  onEditar,
  showEdit = false,
  canEdit = true,
  showMeasures = false,
  onViewMeasures,
}: MovimientoRowProps) {
  const handleRowClick = useCallback(() => {
    onToggle(movement.id);
  }, [onToggle, movement.id]);

  const handleEditClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onEditar && canEdit) onEditar(movement.id);
    },
    [onEditar, movement.id, canEdit]
  );

  const handleMeasuresClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onViewMeasures) onViewMeasures(movement);
    },
    [onViewMeasures, movement]
  );

  const fechaSolicitudFmt = useMemo(
    () => formatoFecha(movement.fechaSolicitud),
    [movement.fechaSolicitud]
  );
  const fechaInicioFmt = useMemo(
    () => formatoFecha(movement.fechaInicio),
    [movement.fechaInicio]
  );
  const fechaFinFmt = useMemo(
    () => formatoFecha(movement.fechaFin),
    [movement.fechaFin]
  );

  const isPriorityHigh = movement.prioridad === "ALTA";

  return (
    <Fragment>
      {/* FILA PRINCIPAL */}
      <tr
        onClick={handleRowClick}
        className={`group cursor-pointer border-l-[3px] transition-all duration-200 ${isOpen
          ? `border-l-emerald-500 ${styles.rowExpanded}`
          : isPriorityHigh
            ? `border-l-rose-400 dark:border-l-rose-500 ${styles.rowBase}`
            : `border-l-transparent ${styles.rowBase}`
          }`}
      >
        {/* Chevron - Hidden on mobile, shown on sm+ */}
        <td className="hidden sm:table-cell px-2 py-3 text-center align-middle sm:px-4 sm:py-4">
          <div className="flex items-center justify-center">
            <ChevronDown
              size={16}
              className={`${styles.chevron} ${isOpen ? styles.chevronExpanded : ""
                }`}
            />
          </div>
        </td>

        <td className="hidden sm:table-cell px-2 py-3 align-middle font-mono text-xs text-slate-400 sm:px-4 sm:py-4 sm:text-xs">
          <span className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-1.5 py-0.5">
            #{movement.id}
          </span>
        </td>

        {/* Locomotora */}
        {/* Locomotora - With embedded chevron on mobile */}
        <td className="px-3 py-4 align-middle sm:px-4 sm:py-4">
          <div className="flex items-center gap-3">
            {/* Mobile Chevron */}
            <div className="sm:hidden text-slate-400">
              <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-500" : ""}`} />
            </div>

            <div
              className={`flex h-10 w-10 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${isOpen
                ? "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-500/20 dark:to-emerald-500/10 dark:text-emerald-400 shadow-sm"
                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-500 dark:group-hover:bg-emerald-900/20 dark:group-hover:text-emerald-400"
                }`}
            >
              <TrainFront size={18} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 sm:text-base tabular-nums">
                {movement.locomotora}
              </span>
              <div className="flex items-center gap-2">
                <span className="sm:hidden font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">#{movement.id}</span>
                {isPriorityHigh && (
                  <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">
                    Alta
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Localidad */}
        <td className="hidden px-2 py-3 align-middle md:table-cell sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <MapPin size={13} className="shrink-0 text-slate-300 dark:text-slate-600" />
            <span className="block max-w-[120px] truncate text-[11px] font-medium md:max-w-[160px] lg:max-w-[220px] sm:text-xs">
              {movement.localidadNombre || "—"}
            </span>
          </div>
        </td>

        {/* Empresa */}
        <td className="hidden px-2 py-3 align-middle md:table-cell sm:px-4 sm:py-4">
          <div className="max-w-[120px] truncate text-[11px] font-medium text-slate-600 dark:text-slate-300 sm:max-w-[180px] lg:max-w-[220px] sm:text-xs">
            {movement.empresaNombre}
          </div>
        </td>

        {/* Fechas */}
        <td className="hidden px-2 py-3 align-middle font-mono text-[11px] text-slate-500 sm:px-4 sm:py-4 sm:text-xs lg:table-cell">
          {fechaSolicitudFmt}
        </td>
        <td className="hidden px-2 py-3 align-middle font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-500 sm:px-4 sm:py-4 sm:text-xs xl:table-cell">
          {fechaInicioFmt}
        </td>
        <td className="hidden px-2 py-3 align-middle font-mono text-[11px] text-slate-500 sm:px-4 sm:py-4 sm:text-xs xl:table-cell">
          {fechaFinFmt}
        </td>

        <td className="px-2 py-3 text-center align-middle sm:px-4 sm:py-4">
          <BadgeEstado estado={movement.estado} />
        </td>

        {showEdit && (
          <td className="px-2 py-3 text-center align-middle sm:px-4 sm:py-4">
            {canEdit ? (
              <button
                type="button"
                onClick={handleEditClick}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm active:scale-95 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                title="Editar movimiento"
              >
                <Edit3 size={13} />
                <span className="hidden sm:inline">Editar</span>
              </button>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                No editable
              </span>
            )}
          </td>
        )}
        {showMeasures && (
          <td className="px-2 py-3 text-center align-middle sm:px-4 sm:py-4">
            {movement.torno ? (
              <button
                type="button"
                onClick={handleMeasuresClick}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs font-semibold text-sky-700 transition-all duration-200 hover:bg-sky-100 hover:border-sky-300 hover:shadow-sm active:scale-95 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50"
                title="Ver medidas de torno"
              >
                <Info size={13} />
                <span className="hidden sm:inline">Medidas</span>
              </button>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                N/A
              </span>
            )}
          </td>
        )}
      </tr>

      {/* DETALLE */}
      <tr className="m-0 border-0 p-0">
        <td colSpan={13} className="m-0 border-0 p-0">
          <div
            className={`${styles.expandedContentContainer} ${isOpen ? styles.show : ""
              }`}
          >
            <ExpandedDetailsContent
              movement={movement}
              fechaSolicitudFmt={fechaSolicitudFmt}
              fechaInicioFmt={fechaInicioFmt}
              fechaFinFmt={fechaFinFmt}
              isPriorityHigh={isPriorityHigh}
            />
          </div>
        </td>
      </tr>
    </Fragment>
  );
});

const MobileCard = memo(function MobileCard({
  movement,
  isOpen,
  onToggle,
  onEditar,
  showEdit = false,
  canEdit = true,
  showMeasures = false,
  onViewMeasures,
}: MovimientoRowProps) {
  const fechaSolicitudFmt = useMemo(
    () => formatoFecha(movement.fechaSolicitud),
    [movement.fechaSolicitud]
  );
  const fechaInicioFmt = useMemo(
    () => formatoFecha(movement.fechaInicio),
    [movement.fechaInicio]
  );
  const fechaFinFmt = useMemo(
    () => formatoFecha(movement.fechaFin),
    [movement.fechaFin]
  );
  const isPriorityHigh = movement.prioridad === "ALTA";

  const toggle = useCallback(() => {
    onToggle(movement.id);
  }, [onToggle, movement.id]);

  const handleEditClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onEditar && canEdit) onEditar(movement.id);
    },
    [onEditar, movement.id, canEdit]
  );

  const handleMeasuresClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onViewMeasures) onViewMeasures(movement);
    },
    [onViewMeasures, movement]
  );

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/80 shadow-sm transition-all ${isOpen ? "ring-1 ring-emerald-400/40" : ""
        }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className="p-3 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${isOpen
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
            >
              <TrainFront size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {movement.locomotora ?? "—"}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="font-mono">#{movement.id}</span>
                {isPriorityHigh && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                    Alta
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <BadgeEstado estado={movement.estado} />
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              {isOpen ? "Ocultar" : "Detalles"}
              <ChevronDown
                size={12}
                className={`transition-transform ${isOpen ? "rotate-180 text-emerald-500" : ""}`}
              />
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Empresa</div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {movement.empresaNombre ?? "—"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Localidad</div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {movement.localidadNombre ?? "—"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Origen</div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              {movement.viaOrigen || "—"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Destino</div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
              {movement.viaDestino || "—"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Solicitud</div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {fechaSolicitudFmt}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Inicio</div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {fechaInicioFmt}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {movement.lavado && <span className="rounded-md bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[9px] font-bold text-cyan-700 dark:bg-cyan-900/20 dark:border-cyan-800 dark:text-cyan-300">LAV</span>}
            {movement.torno && <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[9px] font-bold text-sky-700 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-300">TOR</span>}
            {movement.incidenteGlobal && <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">INC</span>}
          </div>

          <div className="flex items-center gap-2">
            {showMeasures ? (
              movement.torno ? (
                <button
                  type="button"
                  onClick={handleMeasuresClick}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition-all duration-200 hover:bg-sky-100 hover:border-sky-300 hover:shadow-sm active:scale-95 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50"
                >
                  <Info size={12} />
                  <span>Medidas</span>
                </button>
              ) : (
                <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                  N/A
                </span>
              )
            ) : null}

            {showEdit && (
              canEdit ? (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm active:scale-95 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  <Edit3 size={12} />
                  <span>Editar</span>
                </button>
              ) : (
                <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                  No editable
                </span>
              )
            )}
          </div>
        </div>
      </div>

      <div className={`${styles.expandedContentContainer} ${isOpen ? styles.show : ""}`}>
        <ExpandedDetailsContent
          movement={movement}
          fechaSolicitudFmt={fechaSolicitudFmt}
          fechaInicioFmt={fechaInicioFmt}
          fechaFinFmt={fechaFinFmt}
          isPriorityHigh={isPriorityHigh}
        />
      </div>
    </div>
  );
});

function ExpandedDetailsContent({
  movement,
  fechaSolicitudFmt,
  fechaInicioFmt,
  fechaFinFmt,
  isPriorityHigh,
}: {
  movement: Movement;
  fechaSolicitudFmt: string;
  fechaInicioFmt: string;
  fechaFinFmt: string;
  isPriorityHigh: boolean;
}) {
  return (
    <div
      className={`border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 ${styles.expandedInner}`}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1. Resumen Móvil */}
        <div className="col-span-1 md:col-span-2 xl:hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionTitle title="Resumen General" icon={Info} color="slate" />
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoBlock
              label="Localidad"
              value={movement.localidadNombre}
              className="md:hidden"
            />
            <InfoBlock
              label="Empresa"
              value={movement.empresaNombre}
              className="md:hidden"
            />
            <InfoBlock
              label="Solicitud"
              value={fechaSolicitudFmt}
              className="lg:hidden"
            />
            <InfoBlock
              label="Inicio"
              value={fechaInicioFmt}
              className="xl:hidden"
            />
            <InfoBlock
              label="Fin"
              value={fechaFinFmt}
              className="xl:hidden"
            />
          </div>
        </div>

        {/* 2. Operación */}
        <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionTitle title="Operación de Vía" icon={MapPin} color="emerald" />
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2 text-xs dark:border-slate-800/50">
              <span className="text-slate-500">Origen</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {movement.viaOrigen || "?"}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-50 pb-2 text-xs dark:border-slate-800/50">
              <span className="text-slate-500">Destino</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {movement.viaDestino || "?"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <MiniBadge
                label={`Cab: ${movement.posicionCabina}`}
                icon={Flag}
              />
              <MiniBadge
                label={`Chim: ${movement.posicionChimenea}`}
                icon={Flag}
              />
            </div>
          </div>
        </div>

        {/* 3. Personal */}
        <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionTitle title="Personal Asignado" icon={User} color="blue" />
          <div className="mt-3 space-y-2">
            <InfoRow
              label="Supervisor"
              value={movement.supervisorId}
            />
            <InfoRow
              label="Maquinista"
              value={movement.maquinistaId}
            />
            <InfoRow label="Operador" value={movement.operadorId} />
            <InfoRow label="Cliente ID" value={movement.clienteId} />
          </div>
        </div>

        {/* 4. Configuración */}
        <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionTitle title="Servicios y Alertas" icon={Settings} color="amber" />
          <div className="mt-3 flex-1">
            <div className="flex flex-wrap gap-2">
              {movement.lavado && (
                <BooleanChip label="Lavado" type="success" />
              )}
              {movement.torno && (
                <BooleanChip label="Torno" type="success" />
              )}
              {movement.incidenteGlobal && (
                <BooleanChip
                  label="Incidente Global"
                  type="danger"
                />
              )}
              {!movement.lavado &&
                !movement.torno &&
                !movement.incidenteGlobal && (
                  <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-3 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
                    <span className="text-xs italic">
                      Sin servicios activos
                    </span>
                  </div>
                )}
            </div>
          </div>
          {isPriorityHigh && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-600 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-400">
              <AlertTriangle size={14} /> PRIORIDAD ALTA
            </div>
          )}
        </div>

        {/* 5. Instrucciones */}
        {movement.instrucciones && (
          <div className="col-span-1 md:col-span-2 xl:col-span-4">
            <div className="flex items-start gap-4 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-amber-50/40 p-4 shadow-sm dark:border-amber-900/30 dark:from-slate-900/80 dark:to-slate-900/60">
              <div className="mt-0.5 shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-900/40 dark:text-amber-500">
                <Info size={18} />
              </div>
              <div>
                <h5 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                  Instrucciones del Movimiento
                </h5>
                <p className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                  &quot;{movement.instrucciones}&quot;
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== UI COMPONENTS ================== */

interface HeaderCellProps {
  label: string;
  icon: React.ElementType;
  onSort: (c: CampoOrden, d: DireccionOrden) => void;
  sortKey: CampoOrden;
  currentSort: CampoOrden;
  dir: DireccionOrden;
  align?: "left" | "center" | "right";
  className?: string;
}

const HeaderCell = memo(function HeaderCell({
  label,
  icon: Icon,
  onSort,
  sortKey,
  currentSort,
  dir,
  align = "left",
  className = "",
}: HeaderCellProps) {
  const active = sortKey === currentSort;

  const handleClick = useCallback(() => {
    const nextDir: DireccionOrden =
      active && dir === "asc" ? "desc" : "asc";
    onSort(sortKey, nextDir);
  }, [active, dir, onSort, sortKey]);

  return (
    <th
      className={`cursor-pointer select-none px-2 py-3 text-[10px] transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 sm:px-4 sm:py-4 sm:text-[11px] ${className}`}
      onClick={handleClick}
    >
      <div
        className={`flex items-center gap-1.5 ${align === "center" ? "justify-center" : ""
          } ${active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-500 dark:text-slate-400"
          }`}
      >
        <Icon size={13} className={active ? "opacity-100" : "opacity-60"} />
        <span>{label}</span>
        <div className="flex flex-col -space-y-0.5">
          <ArrowUp
            size={8}
            className={`transition-opacity ${active && dir === "asc" ? "opacity-100" : "opacity-25"}`}
          />
          <ArrowDown
            size={8}
            className={`transition-opacity ${active && dir === "desc" ? "opacity-100" : "opacity-25"}`}
          />
        </div>
      </div>
    </th>
  );
});

function BadgeEstado({ estado }: { estado: string }) {
  const badge = BADGE_ESTADO[estado] ?? DEFAULT_BADGE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide shadow-sm ${badge.bg} ${badge.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
      {estado}
    </span>
  );
}

const SECTION_COLORS: Record<string, string> = {
  emerald: "border-l-emerald-400 dark:border-l-emerald-500",
  blue: "border-l-sky-400 dark:border-l-sky-500",
  amber: "border-l-amber-400 dark:border-l-amber-500",
  slate: "border-l-slate-300 dark:border-l-slate-600",
};

interface SectionTitleProps {
  title: string;
  icon: React.ElementType;
  color?: string;
}
function SectionTitle({ title, icon: Icon, color = "emerald" }: SectionTitleProps) {
  return (
    <h4 className={`mb-3 flex items-center gap-2 border-b border-l-2 border-slate-100 pb-2 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 ${SECTION_COLORS[color] ?? SECTION_COLORS.emerald}`}>
      <Icon size={12} className="text-current opacity-70" /> {title}
    </h4>
  );
}

interface InfoRowProps {
  label: string;
  value: string | number | null | undefined;
}
function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-50 py-1.5 text-[11px] last:border-0 dark:border-slate-800/50 sm:text-xs">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="ml-4 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
        {value ?? "—"}
      </span>
    </div>
  );
}

interface InfoBlockProps {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}
function InfoBlock({ label, value, className }: InfoBlockProps) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="break-words text-[11px] font-semibold text-slate-700 dark:text-slate-200 sm:text-xs">
        {value ?? "—"}
      </span>
    </div>
  );
}

function BooleanChip({
  label,
  type,
}: {
  label: string;
  type: "success" | "danger";
}) {
  const baseClass =
    type === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800";
  const Icon = type === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${baseClass}`}
    >
      <Icon size={11} /> {label}
    </span>
  );
}

interface MiniBadgeProps {
  label: string;
  icon: React.ElementType;
}
function MiniBadge({ label, icon: Icon }: MiniBadgeProps) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <Icon size={10} className="opacity-50" /> {label}
    </span>
  );
}

const formatoFecha = (iso: string | null): string => {
  if (!iso) return "—";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;
  return new Date(timestamp).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};
