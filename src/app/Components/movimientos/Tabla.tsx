"use client";

import React,
{
  useState,
  useMemo,
  useCallback,
  useEffect,
  memo,
} from "react";
import {
  ChevronDown,
  Loader2,
  TrainFront,
  MapPin,
  Info,
  User,
  Flag,
  Settings,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Timer,
} from "lucide-react";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Empty from "antd/es/empty";
import Table from "antd/es/table";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import styles from "./Tabla.module.scss";
import type { Movement, CampoOrden, DireccionOrden, Rol } from "./useMovimientos";
import TornoMeasuresViewerModal from "../../movimientos/torno/TornoMeasuresViewerModal";
import { useTornoMeasuresModal } from "@/features/torno-measures";
import {
  BadgeEstado,
  BadgeTipoMovimiento,
  BooleanChip,
  canViewMovementDuration,
  formatTipoMovimientoLabel,
  formatoDuracionMovimiento,
  formatoFecha,
  isClientLikeRole,
} from "@/features/movimientos/table";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";

function getMovementFolio(movement: Movement) {
  if (movement.folioLocalidadLabel) return movement.folioLocalidadLabel;
  if (movement.folioLocalidad) return `#${movement.folioLocalidad}`;
  return `#${movement.id}`;
}

function getMovementTechnicalId(movement: Movement) {
  const raw = movement.idTecnico ?? movement.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : movement.id;
}

function getMovementRowKey(movement: Movement) {
  return `${movement.localidadId || 0}:${getMovementTechnicalId(movement)}`;
}

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
  rol?: Rol;
}

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
  rol,
}: TablaProps) {
  const clienteSoloIds = isClientLikeRole(rol);
  const puedeVerDuracion = canViewMovementDuration(rol);
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const { measuresModal, openMeasuresModal, closeMeasuresModal } =
    useTornoMeasuresModal(API_BASE);

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / tamPagina)),
    [total, tamPagina]
  );

  const tieneFilas = filas.length > 0;

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const startIndex = useMemo(
    () => (total === 0 ? 0 : (pagina - 1) * tamPagina + 1),
    [pagina, tamPagina, total]
  );
  const endIndex = useMemo(
    () => (total === 0 ? 0 : startIndex + filas.length - 1),
    [startIndex, filas.length, total]
  );

  const toggle = useCallback((rowKey: string) => {
    setExpanded((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  }, []);

  const handlePrevPage = useCallback(() => {
    if (pagina > 1) onPagina(pagina - 1);
  }, [pagina, onPagina]);

  const handleNextPage = useCallback(() => {
    if (pagina < totalPaginas) onPagina(pagina + 1);
  }, [pagina, totalPaginas, onPagina]);

  const handleViewMeasures = useCallback(
    (movement: Movement) =>
      openMeasuresModal({
        movementId: getMovementTechnicalId(movement),
        locomotiveLabel: String(movement.locomotora ?? ""),
        companyName: movement.empresaNombre,
      }),
    [openMeasuresModal]
  );

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

  const getSortOrder = useCallback(
    (key: CampoOrden) => {
      if (campoOrden !== key) return null;
      return direccionOrden === "asc" ? "ascend" : "descend";
    },
    [campoOrden, direccionOrden]
  );

  const antColumns = useMemo<ColumnsType<Movement>>(() => {
    const base: ColumnsType<Movement> = [
      {
        title: "Orden",
        key: "orden",
        width: 96,
        fixed: "left",
        render: (_value: unknown, _movement, index) => (
          <span className="inline-flex min-w-10 justify-center rounded-md bg-slate-950 px-2 py-1 font-mono text-xs font-black text-white">
            {startIndex + index}
          </span>
        ),
      },
      {
        title: "Folio",
        key: "id",
        width: 116,
        sorter: true,
        sortOrder: getSortOrder("id"),
        render: (_value: unknown, movement) => {
          return (
            <div className="min-w-0">
              <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {getMovementFolio(movement)}
              </span>
            </div>
          );
        },
      },
      {
        title: "Locomotora",
        dataIndex: "locomotora",
        key: "locomotora",
        width: 150,
        sorter: true,
        sortOrder: getSortOrder("locomotora"),
        render: (_value: unknown, movement) => (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <TrainFront size={17} />
            </span>
            <div className="min-w-0">
              <div className="font-black tabular-nums text-slate-950 dark:text-slate-100">
                {movement.locomotora ?? "—"}
              </div>
              {movement.prioridad === "ALTA" && (
                <div className="text-[10px] font-black uppercase tracking-wide text-rose-500">
                  Prioridad alta
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        title: "Tipo",
        dataIndex: "tipoMovimiento",
        key: "tipo",
        width: 140,
        align: "center",
        sorter: true,
        sortOrder: getSortOrder("tipo"),
        render: (value: Movement["tipoMovimiento"]) => <BadgeTipoMovimiento tipo={value} />,
      },
      {
        title: "Localidad",
        dataIndex: "localidadNombre",
        key: "localidad",
        width: 170,
        sorter: true,
        sortOrder: getSortOrder("localidad"),
        render: (value: Movement["localidadNombre"]) => (
          <span className="inline-flex max-w-[160px] items-center gap-1.5 truncate font-semibold text-slate-600 dark:text-slate-300">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{value || "—"}</span>
          </span>
        ),
      },
      {
        title: "Empresa",
        dataIndex: "empresaNombre",
        key: "empresa",
        width: 190,
        sorter: true,
        sortOrder: getSortOrder("empresa"),
        render: (value: Movement["empresaNombre"]) => (
          <span className="block max-w-[180px] truncate font-semibold text-slate-700 dark:text-slate-200">
            {value || "—"}
          </span>
        ),
      },
      {
        title: "Personal",
        key: "personal",
        width: 250,
        render: (_value: unknown, movement) => {
          const people = [
            ["Cliente", movement.clienteNombre],
            ["Operador", movement.operadorNombre],
            ["Supervisor", movement.supervisorNombre],
            ["Maquinista", movement.maquinistaNombre],
          ] as const;
          const ids = {
            Cliente: movement.clienteId,
            Operador: movement.operadorId,
            Supervisor: movement.supervisorId,
            Maquinista: movement.maquinistaId,
          };
          return (
            <div className="grid grid-cols-2 gap-1">
              {people.map(([label, value]) => (
                <span
                  key={label}
                  className="inline-flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span>{label}</span>
                  <strong className="truncate text-right text-slate-900 dark:text-slate-100">
                    {clienteSoloIds ? ids[label] ?? "—" : value ?? "—"}
                  </strong>
                </span>
              ))}
            </div>
          );
        },
      },
      {
        title: "Origen",
        dataIndex: "viaOrigen",
        key: "viaOrigen",
        width: 130,
        render: (value: Movement["viaOrigen"]) => (
          <span className="font-bold text-emerald-700 dark:text-emerald-300">{value || "—"}</span>
        ),
      },
      {
        title: "Destino",
        dataIndex: "viaDestino",
        key: "viaDestino",
        width: 130,
        render: (value: Movement["viaDestino"]) => (
          <span className="font-bold text-sky-700 dark:text-sky-300">{value || "—"}</span>
        ),
      },
    ];

    base.push({
      title: "Solicitud",
      dataIndex: "fechaSolicitud",
      key: "solicitud",
      width: 150,
      sorter: true,
      sortOrder: getSortOrder("solicitud"),
      render: (value: Movement["fechaSolicitud"]) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{formatoFecha(value)}</span>
      ),
    });
    base.push({
      title: "Inicio",
      dataIndex: "fechaInicio",
      key: "inicio",
      width: 150,
      sorter: true,
      sortOrder: getSortOrder("inicio"),
      render: (value: Movement["fechaInicio"]) => (
        <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">{formatoFecha(value)}</span>
      ),
    });
    base.push({
      title: "Fin",
      dataIndex: "fechaFin",
      key: "fin",
      width: 150,
      sorter: true,
      sortOrder: getSortOrder("fin"),
      render: (value: Movement["fechaFin"]) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{formatoFecha(value)}</span>
      ),
    });
    if (puedeVerDuracion) {
      base.push({
        title: "Resolución",
        key: "resolucion",
        width: 140,
        render: (_value: unknown, movement) => (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Timer size={13} className="text-slate-400" />
            {formatoDuracionMovimiento(movement.fechaInicio, movement.fechaFin)}
          </span>
        ),
      });
    }

    base.push({
        title: "Estado",
        dataIndex: "estado",
        key: "estado",
        width: 150,
        align: "center",
        sorter: true,
        sortOrder: getSortOrder("estado"),
        render: (value: Movement["estado"]) => <BadgeEstado estado={value} />,
    });

    if (showEditColumn) {
      base.push({
        title: "Acción",
        key: "accion",
        width: 120,
        fixed: "right",
        align: "center",
        render: (_value, movement) => {
          const canEdit = puedeEditarMovimiento(movement.estado);
          const movementId = getMovementTechnicalId(movement);
          return canEdit ? (
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onEditar?.(movementId);
              }}
              className="font-bold"
            >
              Editar
            </Button>
          ) : (
            <span className="text-xs font-semibold text-slate-400">No editable</span>
          );
        },
      });
    }

    return base;
  }, [clienteSoloIds, getSortOrder, onEditar, puedeEditarMovimiento, puedeVerDuracion, showEditColumn, startIndex]);

  const handleAntTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      _filters: Record<string, unknown>,
      sorter: SorterResult<Movement> | SorterResult<Movement>[],
      extra?: { action?: "paginate" | "sort" | "filter" }
    ) => {
      const nextPage = Number(pagination.current || 1);
      if (nextPage !== pagina) {
        setExpanded({});
        onPagina(nextPage);
      }

      if (extra?.action !== "sort") return;

      const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const key = String(activeSorter?.columnKey || "") as CampoOrden;
      if (key && activeSorter?.order) {
        onOrden(key, activeSorter.order === "ascend" ? "asc" : "desc");
      }
    },
    [onOrden, onPagina, pagina]
  );

  return (
    <div className="flex h-full w-full flex-col space-y-3 sm:space-y-4 font-sans">
      <div className="relative w-full overflow-x-hidden overflow-y-visible rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm transition-all">
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
        <div className="touch-pan-y space-y-3 px-2 py-3 xl:hidden">
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
                key={getMovementRowKey(movement)}
                rowKey={getMovementRowKey(movement)}
                movement={movement}
                isOpen={Boolean(expanded[getMovementRowKey(movement)])}
                onToggle={toggle}
                onEditar={onEditar}
                showEdit={showEditColumn}
                canEdit={puedeEditarMovimiento(movement.estado)}
                showMeasures={showMeasuresColumn}
                onViewMeasures={handleViewMeasures}
                clienteSoloIds={clienteSoloIds}
                canViewDuration={puedeVerDuracion}
              />
            ))
          )}
        </div>

        <div className="hidden xl:block">
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#059669",
                borderRadius: 10,
                fontFamily: "inherit",
                colorBgContainer: isDarkTheme ? "#141c23" : "#ffffff",
                colorText: isDarkTheme ? "#e8edf1" : "#17212b",
                colorTextSecondary: isDarkTheme ? "#a3afb9" : "#5f6f7d",
                colorBorderSecondary: isDarkTheme ? "#293640" : "#d9e1e7",
              },
              components: {
                Table: {
                  headerBg: isDarkTheme ? "#182129" : "#f8fafb",
                  headerColor: isDarkTheme ? "#e8edf1" : "#5f6f7d",
                  rowHoverBg: isDarkTheme ? "#1d2932" : "#f3f6f8",
                  borderColor: isDarkTheme ? "#293640" : "#d9e1e7",
                  colorBgContainer: isDarkTheme ? "#141c23" : "#ffffff",
                },
              },
            }}
          >
            <Table<Movement>
              virtual={filas.length > 50}
              rowKey={getMovementRowKey}
              className="cosaif-ant-table"
              columns={antColumns}
              dataSource={filas}
              loading={cargando ? { spinning: true, description: "Sincronizando..." } : false}
              size="middle"
              scroll={{ x: 1880, ...(filas.length > 50 ? { y: 640 } : {}) }}
              onChange={handleAntTableChange}
              onRow={(movement) => ({
                onClick: (event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest("button,a,input,select,textarea,[role='button']")) return;
                  toggle(getMovementRowKey(movement));
                },
                className: "cursor-pointer",
              })}
              expandable={{
                expandedRowKeys: Object.entries(expanded)
                  .filter(([, isOpen]) => isOpen)
                  .map(([rowKey]) => rowKey),
                showExpandColumn: false,
                expandIcon: () => null,
                onExpand: (_open, movement) => toggle(getMovementRowKey(movement)),
                expandedRowRender: (movement) => (
                  <ExpandedDetailsContent
                    movement={movement}
                    fechaSolicitudFmt={formatoFecha(movement.fechaSolicitud)}
                    fechaInicioFmt={formatoFecha(movement.fechaInicio)}
                    fechaFinFmt={formatoFecha(movement.fechaFin)}
                    isPriorityHigh={movement.prioridad === "ALTA"}
                    clienteSoloIds={clienteSoloIds}
                    canViewDuration={puedeVerDuracion}
                  />
                ),
              }}
              pagination={{
                current: pagina,
                pageSize: tamPagina,
                total,
                showSizeChanger: false,
                placement: ["bottomCenter"],
                showTotal: (count, range) =>
                  `Mostrando ${range[0]}-${range[1]} de ${count}${totalEstimado ? "+" : ""}`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No hay movimientos registrados"
                  />
                ),
              }}
            />
          </ConfigProvider>
        </div>

        {/* Footer con page pills */}
        <div className="flex flex-col items-center justify-between gap-3 sm:gap-4 rounded-b-xl sm:rounded-b-2xl border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white p-2.5 text-[10px] dark:border-slate-800/60 dark:from-slate-900/80 dark:to-slate-900/60 sm:flex-row sm:p-4 sm:text-xs xl:hidden">
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

/* ================== TARJETA MOVIL ================== */

interface MovimientoRowProps {
  rowKey: string;
  movement: Movement;
  isOpen: boolean;
  onToggle: (rowKey: string) => void;
  onEditar?: (id: number) => void;
  showEdit?: boolean;
  canEdit?: boolean;
  showMeasures?: boolean;
  onViewMeasures?: (movement: Movement) => void;
  clienteSoloIds?: boolean;
  canViewDuration?: boolean;
}

const MobileCard = memo(function MobileCard({
  rowKey,
  movement,
  isOpen,
  onToggle,
  onEditar,
  showEdit = false,
  canEdit = true,
  showMeasures = false,
  onViewMeasures,
  clienteSoloIds = false,
  canViewDuration = true,
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
    onToggle(rowKey);
  }, [onToggle, rowKey]);

  const handleEditClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onEditar && canEdit) onEditar(getMovementTechnicalId(movement));
    },
    [onEditar, movement, canEdit]
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
                <span className="font-mono">{getMovementFolio(movement)}</span>
                <BadgeTipoMovimiento tipo={movement.tipoMovimiento} compact />
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
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Tipo</div>
            <div className="mt-1">
              <BadgeTipoMovimiento tipo={movement.tipoMovimiento} compact />
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
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Fin</div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {fechaFinFmt}
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
          clienteSoloIds={clienteSoloIds}
          canViewDuration={canViewDuration}
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
  clienteSoloIds,
  canViewDuration,
}: {
  movement: Movement;
  fechaSolicitudFmt: string;
  fechaInicioFmt: string;
  fechaFinFmt: string;
  isPriorityHigh: boolean;
  clienteSoloIds: boolean;
  canViewDuration: boolean;
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
              label="Tipo"
              value={formatTipoMovimientoLabel(movement.tipoMovimiento)}
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
            {canViewDuration ? (
              <InfoBlock
                label="Resolución"
                value={formatoDuracionMovimiento(movement.fechaInicio, movement.fechaFin)}
              />
            ) : null}
          </div>
        </div>

        {/* 2. Operación */}
        <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SectionTitle title="Operación de Vía" icon={MapPin} color="emerald" />
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2 text-xs dark:border-slate-800/50">
              <span className="text-slate-500">Tipo</span>
              <BadgeTipoMovimiento tipo={movement.tipoMovimiento} compact />
            </div>
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
              value={clienteSoloIds ? movement.supervisorId : movement.supervisorNombre}
            />
            <InfoRow
              label="Maquinista"
              value={clienteSoloIds ? movement.maquinistaId : movement.maquinistaNombre}
            />
            <InfoRow label="Operador" value={clienteSoloIds ? movement.operadorId : movement.operadorNombre} />
            <InfoRow label="Cliente" value={clienteSoloIds ? movement.clienteId : movement.clienteNombre} />
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
