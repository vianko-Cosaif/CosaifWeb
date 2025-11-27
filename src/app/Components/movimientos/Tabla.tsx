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

/* --- PROPS --- */
interface TablaProps {
  filas: Movement[];
  pagina: number;
  tamPagina: number;
  total: number;
  campoOrden: CampoOrden;
  direccionOrden: DireccionOrden;
  cargando?: boolean;
  onPagina: (p: number) => void;
  onOrden: (c: CampoOrden, d: DireccionOrden) => void;
  onEditar?: (id: number) => void;
}

/* ================== CONSTANTES UI ================== */

const BADGE_ESTADO_STYLES: Record<string, string> = {
  SOLICITADO:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800",
  EN_PROCESO:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  CONCLUIDO:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  CANCELADO:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
  DETENIDO:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
};

/* ================== COMPONENTE PRINCIPAL ================== */

function TablaInner({
  filas,
  pagina,
  tamPagina,
  total,
  campoOrden,
  direccionOrden,
  cargando,
  onPagina,
  onOrden,
  onEditar,
}: TablaProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / tamPagina)),
    [total, tamPagina]
  );

  // Importante: aquí YA NO se vuelve a paginar ni a ordenar.
  // useMovimientos es el dueño del orden y la paginación.
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

  return (
    <div className="flex h-full w-full flex-col space-y-4 font-sans">
      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all dark:border-slate-800 dark:bg-slate-950">
        {/* Loader Overlay */}
        {cargando && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-slate-950/60">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="animate-spin text-emerald-600" size={20} />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Sincronizando...
              </span>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className={`w-full overflow-x-auto ${styles.tableContainer}`}>
          <table className="w-full border-collapse text-left">
            {/* HEADER */}
            <thead
              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${styles.glassHeader}`}
            >
              <tr>
                <th className="w-10 px-2 py-2 text-center sm:w-12 sm:px-4 sm:py-4">
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

                {/* Responsive Columns */}
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

                {onEditar && (
                  <th className="px-2 py-2 text-right sm:px-4 sm:py-4">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-[11px] dark:divide-slate-800/50 sm:text-xs md:text-sm">
              {!tieneFilas ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center sm:py-20">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="rounded-full bg-slate-50 p-4 text-slate-400 dark:bg-slate-900">
                        <Info size={32} strokeWidth={1.5} />
                      </div>
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        No hay movimientos registrados
                      </p>
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
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-b-2xl border-t border-slate-200 bg-slate-50 p-3 text-[11px] dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:p-4 sm:text-xs">
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
                <span className="font-bold text-emerald-600 dark:text-emerald-500">
                  {total}
                </span>{" "}
                · página{" "}
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {pagina}
                </span>{" "}
                de {totalPaginas}
              </>
            )}
          </p>

          <div className="order-1 flex gap-2 sm:order-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={pagina <= 1}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-all hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={pagina >= totalPaginas}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-all hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
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
}

const MovimientoRow = memo(function MovimientoRow({
  movement,
  isOpen,
  onToggle,
  onEditar,
}: MovimientoRowProps) {
  const handleRowClick = useCallback(() => {
    onToggle(movement.id);
  }, [onToggle, movement.id]);

  const handleEditClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onEditar) onEditar(movement.id);
    },
    [onEditar, movement.id]
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

  return (
    <Fragment>
      {/* FILA PRINCIPAL */}
      <tr
        onClick={handleRowClick}
        className={`group cursor-pointer border-l-[3px] ${
          isOpen
            ? `border-l-emerald-500 ${styles.rowExpanded}`
            : `border-l-transparent ${styles.rowBase}`
        }`}
      >
        {/* Chevron */}
        <td className="px-2 py-3 text-center align-middle sm:px-4 sm:py-4">
          <div className="flex items-center justify-center">
            <ChevronDown
              size={18}
              className={`${styles.chevron} ${
                isOpen ? styles.chevronExpanded : ""
              }`}
            />
          </div>
        </td>

        <td className="px-2 py-3 align-middle font-mono text-[10px] text-slate-500 sm:px-4 sm:py-4 sm:text-xs">
          #{movement.id}
        </td>

        {/* Locomotora */}
        <td className="px-2 py-3 align-middle sm:px-4 sm:py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300 ${
                isOpen
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700"
              }`}
            >
              <TrainFront size={16} strokeWidth={2} />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-200 sm:text-base">
              {movement.locomotora}
            </span>
          </div>
        </td>

        {/* Localidad */}
        <td className="hidden px-2 py-3 align-middle md:table-cell sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <MapPin size={14} className="shrink-0 text-slate-400" />
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

        {onEditar && (
          <td className="px-2 py-3 text-right align-middle sm:px-4 sm:py-4">
            <button
              type="button"
              onClick={handleEditClick}
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
            >
              <Edit3 size={16} />
            </button>
          </td>
        )}
      </tr>

      {/* DETALLE */}
      <tr className="m-0 border-0 p-0">
        <td colSpan={12} className="m-0 border-0 p-0">
          <div
            className={`${styles.expandedContentContainer} ${
              isOpen ? styles.show : ""
            }`}
          >
            <div
              className={`border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 ${styles.expandedInner}`}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {/* 1. Resumen Móvil */}
                <div className="col-span-1 md:col-span-2 xl:hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <SectionTitle title="Resumen General" icon={Info} />
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
                  <SectionTitle title="Operación de Vía" icon={MapPin} />
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
                  <SectionTitle title="Personal Asignado" icon={User} />
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
                  <SectionTitle title="Servicios y Alertas" icon={Settings} />
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
                          <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-3 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
                            <span className="text-xs italic">
                              Sin servicios activos
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                  {movement.prioridad === "ALTA" && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-400">
                      <AlertTriangle size={14} /> PRIORIDAD ALTA
                    </div>
                  )}
                </div>

                {/* 5. Instrucciones */}
                {movement.instrucciones && (
                  <div className="col-span-1 md:col-span-2 xl:col-span-4">
                    <div className="flex items-start gap-4 rounded-xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/30 dark:bg-slate-900/80">
                      <div className="mt-0.5 shrink-0 rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-500">
                        <Info size={18} />
                      </div>
                      <div>
                        <h5 className="mb-1 text-xs font-bold uppercase text-amber-700 dark:text-amber-500">
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
          </div>
        </td>
      </tr>
    </Fragment>
  );
});

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
      className={`cursor-pointer select-none px-2 py-2 text-[10px] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-4 sm:py-4 sm:text-[11px] ${className}`}
      onClick={handleClick}
    >
      <div
        className={`flex items-center gap-2 ${
          align === "center" ? "justify-center" : ""
        } ${
          active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-500 group-hover:text-emerald-500 dark:text-slate-400"
        }`}
      >
        <Icon size={14} className={active ? "opacity-100" : "opacity-70"} />
        <span>{label}</span>
        <div className="flex flex-col">
          <ArrowUp
            size={8}
            className={active && dir === "asc" ? "opacity-100" : "opacity-30"}
          />
          <ArrowDown
            size={8}
            className={active && dir === "desc" ? "opacity-100" : "opacity-30"}
          />
        </div>
      </div>
    </th>
  );
});

function BadgeEstado({ estado }: { estado: string }) {
  const className =
    BADGE_ESTADO_STYLES[estado] ??
    "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${className}`}
    >
      {estado}
    </span>
  );
}

interface SectionTitleProps {
  title: string;
  icon: React.ElementType;
}
function SectionTitle({ title, icon: Icon }: SectionTitleProps) {
  return (
    <h4 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[10px] font-bold uppercase text-slate-400 dark:border-slate-800">
      <Icon size={12} className="text-emerald-500" /> {title}
    </h4>
  );
}

interface InfoRowProps {
  label: string;
  value: string | number | null | undefined;
}
function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-50 py-1 text-[11px] last:border-0 dark:border-slate-800/50 sm:text-xs">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="ml-4 text-right font-medium text-slate-700 dark:text-slate-200">
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
      <span className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </span>
      <span className="break-words text-[11px] font-medium text-slate-700 dark:text-slate-200 sm:text-xs">
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
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold ${baseClass}`}
    >
      <Icon size={10} /> {label}
    </span>
  );
}

interface MiniBadgeProps {
  label: string;
  icon: React.ElementType;
}
function MiniBadge({ label, icon: Icon }: MiniBadgeProps) {
  return (
    <span className="flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
