"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, MapPin, Timer, TrainFront } from "lucide-react";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Empty from "antd/es/empty";
import Table from "antd/es/table";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { BadgeEstado, BadgeTipoMovimiento, formatoDuracionMovimiento, formatoFecha } from "@/features/movimientos/table";
import { useTrainingTour } from "@/features/capacitacion/TrainingTourContext";
import type { Movement, CampoOrden } from "./useMovimientos";
import { getMovementFolio, getMovementRowKey, getMovementTechnicalId } from "./movementPresentation";
import type { TablaProps } from "./table.types";

type Props = Pick<TablaProps, "filas" | "pagina" | "tamPagina" | "total" | "totalEstimado" | "campoOrden" | "direccionOrden" | "cargando" | "onPagina" | "onOrden" | "onEditar" | "puedeEditarFila"> & {
  clienteSoloIds: boolean;
  puedeVerDuracion: boolean;
  puedeEditarMovimiento: (estado?: string) => boolean;
  showEditColumn: boolean;
  startIndex: number;
  expanded: Record<string, boolean>;
  toggle: (rowKey: string) => void;
  renderExpandedDetails: (movement: Movement) => ReactNode;
};

export default function DesktopMovementTable({
  filas, pagina, tamPagina, total, totalEstimado, campoOrden, direccionOrden, cargando,
  onPagina, onOrden, onEditar, puedeEditarFila, clienteSoloIds, puedeVerDuracion,
  puedeEditarMovimiento, showEditColumn, startIndex, expanded, toggle, renderExpandedDetails,
}: Props) {
  const trainingTour = useTrainingTour();
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

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
        title: "Fila",
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
              <button type="button"
                onClick={() => toggle(getMovementRowKey(movement))}
                aria-expanded={Boolean(expanded[getMovementRowKey(movement)])}
                aria-label={`${expanded[getMovementRowKey(movement)] ? "Ocultar" : "Ver"} detalles del movimiento ${getMovementFolio(movement)}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-md bg-[var(--app-accent-soft)] px-2 py-1 font-mono text-xs font-semibold text-[var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]">
                {getMovementFolio(movement)}
                <ChevronDown size={14} aria-hidden className={expanded[getMovementRowKey(movement)] ? "rotate-180" : ""} />
              </button>
              {movement.rondaNumero != null ? <span className="mt-1 block text-xs text-[var(--app-text-muted)]">Ronda {movement.rondaNumero} · orden {movement.ordenEnRonda ?? "—"}</span> : null}
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
            Cliente: movement.clienteId || null,
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
          const canEdit = puedeEditarMovimiento(movement.estado) && (!puedeEditarFila || puedeEditarFila(movement));
          const movementId = getMovementTechnicalId(movement);
          return canEdit ? (
            <Button
              size="small"
              data-training-edit-movement={trainingTour.isTrainingMovement(movementId) ? String(movementId) : undefined}
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
  }, [clienteSoloIds, expanded, getSortOrder, onEditar, puedeEditarFila, puedeEditarMovimiento, puedeVerDuracion, showEditColumn, startIndex, toggle, trainingTour]);

  const handleAntTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      _filters: Record<string, unknown>,
      sorter: SorterResult<Movement> | SorterResult<Movement>[],
      extra?: { action?: "paginate" | "sort" | "filter" }
    ) => {
      const nextPage = Number(pagination.current || 1);
      if (nextPage !== pagina) {
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
              onRow={(movement, rowIndex) => ({
                onClick: (event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest("button,a,input,select,textarea,[role='button']")) return;
                  toggle(getMovementRowKey(movement));
                },
                className: "cursor-pointer",
                "data-guide-id": rowIndex === 0 ? "training-movement-row" : undefined,
                "data-training-movement-id": trainingTour.isTrainingMovement(movement.id) ? String(movement.id) : undefined,
              })}
              expandable={{
                expandedRowKeys: Object.entries(expanded)
                  .filter(([, isOpen]) => isOpen)
                  .map(([rowKey]) => rowKey),
                showExpandColumn: false,
                expandIcon: () => null,
                onExpand: (_open, movement) => toggle(getMovementRowKey(movement)),
                expandedRowRender: (movement) => (
                  <div data-training-movement-details={trainingTour.isTrainingMovement(movement.id) ? String(movement.id) : undefined}>
                  {renderExpandedDetails(movement)}
                  </div>
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
  );
}
