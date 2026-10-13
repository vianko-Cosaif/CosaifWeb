"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Link2,
  TrainFront,
  MapPin,
  UserRound,
} from "lucide-react";
import ConfigProvider from "antd/es/config-provider";
import Table from "antd/es/table";
import type { ColumnsType } from "antd/es/table";
import NaturalMovementDetails from "./NaturalMovementDetails";
import { BadgeEstado, BadgeTipoMovimiento } from "@/features/movimientos/table/MovementBadges";
import StatusBadge from "@/components/ui/StatusBadge";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";
import {
  configurationLabel,
  dateLabel,
  naturalTiming,
  poleLabel,
  sectionPositionLabel,
  movementIncidents,
  personName,
  unitPriority,
  type QueueIncident,
  type QueuePhoto,
  type QueueUnit,
  type QueueMovement,
} from "../queueView";
import s from "./naturalQueue.module.scss";

type Props = {
  units: QueueUnit[];
  dispatch: boolean;
  canResolveIncidents?: boolean;
  showWaitTime: boolean;
  showImages: boolean;
  showFinish: boolean;
  followUp?: boolean;
  selected: number[];
  onSelect: (id: number, checked: boolean) => void;
  operators: { id: number; nombre: string }[];
  busy: boolean;
  mutate: (path: string, body: unknown) => Promise<void>;
  onHistory: (id: number) => void;
};
type TableRow = { unit: QueueUnit; movement: QueueMovement; index: number; unitIndex: number };
export default function NaturalQueueTable({
  units,
  dispatch,
  canResolveIncidents = dispatch,
  showWaitTime,
  showImages,
  showFinish,
  followUp = false,
  selected,
  onSelect,
  operators,
  busy,
  mutate,
  onHistory,
}: Props) {
  const [expanded, setExpanded] = useState<number[]>([]);
  const [assignment, setAssignment] = useState<Record<number, string>>({});
  const [solution, setSolution] = useState<Record<number, string>>({});
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const prefix = useId();
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const toggle = (id: number) =>
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  const rows = units.flatMap((unit, unitIndex) =>
    unit.movimientos.map((movement, index) => ({ unit, movement, index, unitIndex })),
  );
  const section = (movement: QueueMovement, side: "Origen" | "Destino") =>
    sectionPositionLabel(
      movement[`seccion${side}Numero`],
      movement[`seccion${side}NombreSnapshot`],
      Boolean(movement[`seccion${side}Id`]),
    );
  const renderRoute = (movement: QueueMovement, side: "Origen" | "Destino") => (
    <div className={s.route}>
      <span className={side === "Origen" ? s.routeOrigin : s.routeDestination}>
        <span className={s.routeDot} />
        <span>
          <strong>
            {movement[`via${side}NombreSnapshot`] ||
              (movement[`via${side}Id`] ? `Vía #${movement[`via${side}Id`]}` : "Vía sin registrar")}
          </strong>
          <span
            className={s.sectionBadge}
            data-empty={
              !movement[`seccion${side}Id`] &&
              !movement[`seccion${side}Numero`] &&
              !movement[`seccion${side}NombreSnapshot`]
            }
          >
            {section(movement, side)}
          </span>
          <span className={s.poleLabel}>
            Polo de {side === "Origen" ? "salida" : "llegada"}:{" "}
            <strong>{poleLabel(movement[`polo${side}`])}</strong>
          </span>
        </span>
      </span>
    </div>
  );
  const cells: Record<string, (row: TableRow) => ReactNode> = {
    fila: ({ unit, index, unitIndex }) => (
      <div className={s.orderCell}>
        <div className={s.orderTop}>
          {index === 0 && dispatch && unit.estado === "PENDIENTE" && (
            <input
              type="checkbox"
              aria-label={`Seleccionar unidad ${unit.id}`}
              checked={selected.includes(unit.id)}
              disabled={busy}
              onChange={(e) => onSelect(unit.id, e.target.checked)}
            />
          )}
          <strong className={followUp ? s.rowNumber : undefined}>
            {String(unit.posicion ?? unitIndex + 1).padStart(2, "0")}
          </strong>
        </div>
        <span className={s.orderHint}>{unitPriority(unit)}</span>
        {unit.modalidad === "CONJUNTO" && (
          <span className={s.groupTag}>
            <Link2 size={13} aria-hidden /> Conjunto #{unit.id}
            <small>
              {unit.totalIntegrantes && unit.totalIntegrantes > unit.movimientos.length
                ? `${unit.movimientos.length} de ${unit.totalIntegrantes} visibles`
                : `${index + 1} / ${unit.movimientos.length}`}
            </small>
          </span>
        )}
      </div>
    ),
    folio: ({ movement }) => (
      <button
        type="button"
        className={followUp ? s.folioButton : s.detailButton}
        aria-label={`Ver folio ${movement.id}`}
        aria-expanded={expanded.includes(movement.id)}
        onClick={() => toggle(movement.id)}
      >
        #{movement.id}
        {followUp && (
          <ChevronDown
            size={14}
            aria-hidden
            className={expanded.includes(movement.id) ? "rotate-180" : ""}
          />
        )}
      </button>
    ),
    locomotora: ({ movement }) => (
      <div className="flex items-center gap-3">
        {followUp && (
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <TrainFront size={17} aria-hidden />
          </span>
        )}
        <strong className="font-black tabular-nums text-slate-950 dark:text-slate-100">
          {movement.locomotiveNumber}
        </strong>
      </div>
    ),
    tipo: ({ movement }) => (
      <div>
        <BadgeTipoMovimiento tipo={movement.tipoMovimiento} />
        {movement.tipoMovimiento === "REMOLCADA" && (
          <p className={s.towing}>
            Remolca {movement.locomotoraRemolque ?? "—"} ·{" "}
            {configurationLabel(movement.direccionEmpuje)}
          </p>
        )}
      </div>
    ),
    localidad: ({ movement }) => (
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
        <MapPin size={13} aria-hidden className="shrink-0 text-slate-400" />
        {movement.localidadNombreSnapshot || "Torreón"}
      </span>
    ),
    empresa: ({ movement }) => (
      <strong className="font-semibold text-slate-700 dark:text-slate-200">
        {movement.empresaNombreSnapshot ||
          (movement.empresaId ? `Empresa #${movement.empresaId}` : "Sin registrar")}
      </strong>
    ),
    personal: ({ unit, movement }) => (
      <div className={`${s.tablePeople} ${followUp ? s.compactPeople : ""}`}>
        {[
          [
            "Cliente",
            personName(
              movement.cliente ??
                (movement.clienteId === movement.creadoPorId ? movement.creadoPor : null),
              movement.clienteId,
            ),
          ],
          ["Coordinador", personName(movement.coordinador, movement.coordinadorId, "Por asignar")],
          ["Supervisor", personName(movement.supervisor, movement.supervisorId)],
          [
            "Maquinista",
            personName(movement.operador ?? unit.operador, movement.operadorId ?? unit.operadorId),
          ],
        ].map(([label, value]) => (
          <div key={label} className={s.person}>
            <span>{label}</span>
            <strong title={value}>{value}</strong>
          </div>
        ))}
      </div>
    ),
    origen: ({ movement }) => renderRoute(movement, "Origen"),
    destino: ({ movement }) => renderRoute(movement, "Destino"),
    solicitud: ({ unit, movement }) => (
      <time
        className={s.timeCell}
        dateTime={movement.fechaSolicitud ?? unit.fechaRecepcion ?? undefined}
      >
        {dateLabel(movement.fechaSolicitud ?? unit.fechaRecepcion)}
      </time>
    ),
    inicio: ({ unit, movement }) =>
      (movement.fechaInicio ?? unit.fechaInicio) ? (
        <time
          className={s.timeCell}
          dateTime={movement.fechaInicio ?? unit.fechaInicio ?? undefined}
        >
          {dateLabel(movement.fechaInicio ?? unit.fechaInicio)}
        </time>
      ) : (
        <span className={s.unassigned}>Pendiente de inicio</span>
      ),
    fin: ({ unit, movement }) => (
      <time className={s.timeCell} dateTime={movement.fechaFin ?? unit.fechaFin ?? undefined}>
        {dateLabel(movement.fechaFin ?? unit.fechaFin)}
      </time>
    ),
    tiempo: ({ unit, movement }) => {
      const time = naturalTiming(unit, movement);
      return (
        <div className={s.timeCell}>
          <span>{time.label}</span>
          <strong>{time.value}</strong>
          {time.total && <small>Tiempo total: {time.total}</small>}
        </div>
      );
    },
    estado: ({ unit, movement }) => (
      <div className={s.statusStack}>
        {followUp && unit.estado !== "LISTA_REANUDAR" ? (
          <BadgeEstado estado={movement.estado} />
        ) : (
          <StatusBadge
            status={movement.estado}
            label={
              unit.estado === "LISTA_REANUDAR"
                ? "Listo para continuar"
                : (
                    {
                      SOLICITADO: "Por iniciar",
                      ASIGNADO: "Por iniciar",
                      EN_PROCESO: "En curso",
                      DETENIDO: "Con incidente",
                      CONCLUIDO: "Concluido",
                      CANCELADO: "Cancelado",
                    } as Record<string, string>
                  )[movement.estado]
            }
            tone={
              unit.estado === "LISTA_REANUDAR"
                ? "success"
                : movement.estado === "DETENIDO"
                  ? "danger"
                  : undefined
            }
            size="sm"
            dot
          />
        )}
        {unit.ordenManual != null && unit.estado === "PENDIENTE" && (
          <span className={s.priorityTag}>Prioridad asignada</span>
        )}
        {unit.incidenteBloqueanteId && unit.estado !== "DETENIDA" && (
          <span className={s.blockedTag}>Ruta bloqueada</span>
        )}
        {showImages && (
          <span className={s.photoCount}>
            <Camera size={13} aria-hidden />
            {movement.fotos?.length
              ? `${movement.fotos.length} ${movement.fotos.length === 1 ? "foto" : "fotos"}`
              : "Sin fotos"}
          </span>
        )}
      </div>
    ),
    incidentes: ({ unit, movement }) => {
      const incidents = movementIncidents(unit, movement);
      const open = incidents.filter((incident) => incident.estado === "ABIERTO");
      return (
        <div className={s.incidentsSummary}>
          {open.length || unit.incidenteBloqueanteId ? (
            <button
              type="button"
              className={s.incidentButton}
              aria-label={`Ver incidentes del movimiento ${movement.id}`}
              onClick={() => {
                if (!expanded.includes(movement.id)) toggle(movement.id);
              }}
            >
              <AlertTriangle size={14} aria-hidden />
              {open.length
                ? `${open.length} ${open.length === 1 ? "abierto" : "abiertos"}`
                : `Bloqueo #${unit.incidenteBloqueanteId}`}
            </button>
          ) : (
            <span className={s.noIncidents}>
              {incidents.length ? "Resueltos" : "Sin incidentes"}
            </span>
          )}
          {open[0] && (
            <span className={s.incidentReason} title={open[0].motivo}>
              #{open[0].id} · {open[0].motivo}
            </span>
          )}
          {!open.length && incidents.length > 0 && <small>{incidents.length} en historial</small>}
        </div>
      );
    },
    detalle: ({ movement }) => (
      <button
        type="button"
        className={s.detailButton}
        aria-label={`${expanded.includes(movement.id) ? "Ocultar" : "Ver"} detalle del movimiento ${movement.id}`}
        aria-expanded={expanded.includes(movement.id)}
        aria-controls={
          expanded.includes(movement.id) ? `${prefix}-movement-${movement.id}` : undefined
        }
        onClick={() => toggle(movement.id)}
      >
        {expanded.includes(movement.id) ? (
          <ChevronUp size={16} aria-hidden />
        ) : (
          <ChevronDown size={16} aria-hidden />
        )}
        {expanded.includes(movement.id) ? "Cerrar" : "Detalle"}
      </button>
    ),
  };
  const columns: ColumnsType<TableRow> = [
    {
      title: "Fila",
      key: "fila",
      width: 96,
      fixed: "left",
      render: (_, row) => cells.fila(row),
    },
    {
      title: "Folio",
      key: "folio",
      width: 116,
      render: (_, row) => cells.folio(row),
    },
    {
      title: "Locomotora",
      key: "locomotora",
      width: 150,
      render: (_, row) => cells.locomotora(row),
    },
    {
      title: "Tipo",
      key: "tipo",
      align: followUp ? "center" : "left",
      width: 140,
      render: (_, row) => cells.tipo(row),
    },
    {
      title: "Localidad",
      key: "localidad",
      width: 170,
      render: (_, row) => cells.localidad(row),
    },
    {
      title: "Empresa",
      key: "empresa",
      width: 190,
      render: (_, row) => cells.empresa(row),
    },
    {
      title: "Personal",
      key: "personal",
      width: 280,
      render: (_, row) => cells.personal(row),
    },
    {
      title: "Origen",
      key: "origen",
      width: 170,
      render: (_, row) => cells.origen(row),
    },
    {
      title: "Destino",
      key: "destino",
      width: 170,
      render: (_, row) => cells.destino(row),
    },
    {
      title: "Solicitud",
      key: "solicitud",
      width: 150,
      render: (_, row) => cells.solicitud(row),
    },
    {
      title: "Inicio",
      key: "inicio",
      width: 150,
      render: (_, row) => cells.inicio(row),
    },
  ];
  if (showFinish)
    columns.push({
      title: "Fin",
      key: "fin",
      width: 150,
      render: (_, row) => cells.fin(row),
    });
  if (showWaitTime)
    columns.push({
      title: "Resolución / tiempo",
      key: "tiempo",
      width: 140,
      render: (_, row) => cells.tiempo(row),
    });
  columns.push(
    {
      title: "Estado",
      key: "estado",
      align: followUp ? "center" : "left",
      width: 150,
      render: (_, row) => cells.estado(row),
    },
    {
      title: "Incidentes",
      key: "incidentes",
      width: 150,
      render: (_, row) => cells.incidentes(row),
    },
    {
      title: "Detalle",
      key: "detalle",
      width: 110,
      fixed: followUp ? undefined : "right",
      render: (_, row) => cells.detalle(row),
    },
  );
  const renderDetail = ({ unit, movement }: TableRow) => {
    const incidents = movementIncidents(unit, movement);
    return (
      <div id={`${prefix}-movement-${movement.id}`} className={followUp ? s.gdlDetail : undefined}>
        <div className={s.detailContent}>
          <div className={s.detailHeader}>
            <strong>
              Solicitud #{movement.id} · Locomotora {movement.locomotiveNumber}
            </strong>
            <button type="button" className={s.textButton} onClick={() => onHistory(unit.id)}>
              <History size={15} aria-hidden /> Ver historial de operación
            </button>
          </div>
          <NaturalMovementDetails
            unit={unit}
            movement={movement}
            showFinish={showFinish}
            showWaitTime={showWaitTime}
          />
          {dispatch && !["EN_PROCESO", "CONCLUIDA", "CANCELADA"].includes(unit.estado) && (
            <div className={s.assignment}>
              <UserRound size={17} aria-hidden />
              <div>
                <strong>
                  Asignación de maquinista
                  {unit.modalidad === "CONJUNTO" ? ` · Conjunto #${unit.id}` : ""}
                </strong>
                <small>
                  {unit.modalidad === "CONJUNTO"
                    ? "La asignación aplica a todos los movimientos del conjunto."
                    : "Selecciona quién atenderá esta solicitud."}
                </small>
              </div>
              <select
                aria-label={`Asignar unidad ${unit.id}`}
                className={s.field}
                value={assignment[unit.id] ?? ""}
                onChange={(e) =>
                  setAssignment((prev) => ({
                    ...prev,
                    [unit.id]: e.target.value,
                  }))
                }
              >
                <option value="">Seleccionar maquinista</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={s.primaryButton}
                disabled={busy || !assignment[unit.id]}
                onClick={() =>
                  void mutate(`/cola/${unit.id}/asignar`, {
                    operadorId: Number(assignment[unit.id]),
                  })
                }
              >
                Asignar
              </button>
              {!operators.length && (
                <small>No hay maquinistas disponibles en esta localidad.</small>
              )}
            </div>
          )}
          {showImages && (
            <div className={s.evidence}>
              <h3>
                <Camera size={15} aria-hidden /> Evidencias del movimiento{" "}
                <span>{movement.fotos?.length ?? 0}</span>
              </h3>
              {movement.fotos?.length ? (
                <PhotoLinks photos={movement.fotos} movement />
              ) : (
                <p className={s.muted}>Aún no se han registrado fotografías.</p>
              )}
            </div>
          )}
          {unit.incidenteBloqueanteId &&
            !incidents.some((incident) => incident.id === unit.incidenteBloqueanteId) && (
              <div className={s.routeBlock}>
                <AlertTriangle size={17} aria-hidden />
                Ruta bloqueada por el incidente #{unit.incidenteBloqueanteId}. La solicitud requiere
                la solución del bloqueo para continuar.
              </div>
            )}
          {incidents.map((incident) => (
            <IncidentDetail
              key={incident.id}
              incident={incident}
              canResolve={canResolveIncidents}
              showImages={showImages}
              busy={busy}
              solution={solution[incident.id] ?? ""}
              onSolution={(value) =>
                setSolution((prev) => ({
                  ...prev,
                  [incident.id]: value,
                }))
              }
              onResolve={() =>
                void mutate(`/incidentes/${incident.id}/resolver?tipo=NATURAL`, {
                  solucion: solution[incident.id],
                })
              }
            />
          ))}
        </div>
      </div>
    );
  };
  return (
    <div
      role="region"
      aria-label="Tabla de movimientos naturales"
      className={`${s.tableScroll} ${followUp ? s.gdlTableFrame : ""}`}
      tabIndex={0}
    >
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
        <Table<TableRow>
          className={`cosaif-ant-table ${followUp ? s.gdlMovementTable : ""}`}
          rowKey={(row) => row.movement.id}
          columns={columns}
          dataSource={rows}
          pagination={
            followUp
              ? {
                  pageSize: 25,
                  showSizeChanger: false,
                  placement: ["bottomCenter"],
                  showTotal: (count, range) => `Mostrando ${range[0]}-${range[1]} de ${count}`,
                }
              : false
          }
          size="middle"
          scroll={{
            x: columns.reduce((total, column) => total + Number(column.width ?? 150), 0),
          }}
          onRow={(row) => ({
            onClick: (event) => {
              if (!followUp) return;
              const target = event.target as HTMLElement | null;
              if (target?.closest("button,a,input,select,textarea,[role='button']")) return;
              toggle(row.movement.id);
            },
            className: followUp ? "cursor-pointer" : undefined,
          })}
          rowClassName={(row) => (selected.includes(row.unit.id) ? s.selectedTableRow : "")}
          expandable={{
            expandedRowKeys: expanded,
            showExpandColumn: false,
            expandIcon: () => null,
            expandedRowRender: renderDetail,
          }}
          locale={{ emptyText: "No hay movimientos registrados" }}
        />
      </ConfigProvider>
    </div>
  );
}
function PhotoLinks({ photos, movement = false }: { photos: QueuePhoto[]; movement?: boolean }) {
  const labels: Record<string, string> = {
    ANTES_MOVIMIENTO: "Antes del movimiento",
    PROCESO_MOVIMIENTO: "Durante el movimiento",
    FIN_MOVIMIENTO: "Fin del movimiento",
  };
  return (
    <div className={s.photoLinks}>
      {photos.map((photo, index) => {
        const url = toTorreonImageProxyUrl(photo.url);
        return url ? (
          <a key={photo.id ?? index} href={url} target="_blank" rel="noopener noreferrer">
            <Camera size={14} aria-hidden />
            <span>
              {movement && photo.tipo
                ? (labels[photo.tipo] ?? configurationLabel(photo.tipo))
                : `Evidencia ${index + 1}`}
              {photo.tomadaAt && <small>{dateLabel(photo.tomadaAt)}</small>}
              {photo.comentario && <small>{photo.comentario}</small>}
            </span>
            <ExternalLink size={12} aria-hidden />
          </a>
        ) : null;
      })}
    </div>
  );
}
function IncidentDetail({
  incident,
  canResolve,
  showImages,
  busy,
  solution,
  onSolution,
  onResolve,
}: {
  incident: QueueIncident;
  canResolve: boolean;
  showImages: boolean;
  busy: boolean;
  solution: string;
  onSolution: (value: string) => void;
  onResolve: () => void;
}) {
  return (
    <section
      className={s.incidentDetail}
      data-open={incident.estado === "ABIERTO"}
      aria-label={`Incidente ${incident.id}`}
    >
      <div className={s.incidentHeader}>
        <strong>
          <AlertTriangle size={16} aria-hidden />
          Incidente #{incident.id}
        </strong>
        <StatusBadge status={incident.estado} size="sm" />
        <time dateTime={incident.fechaInicio}>Reportado: {dateLabel(incident.fechaInicio)}</time>
      </div>
      <p>{incident.motivo}</p>
      {showImages &&
        (incident.fotos?.length ? (
          <PhotoLinks photos={incident.fotos} />
        ) : (
          <p className={s.muted}>Sin fotografías del incidente.</p>
        ))}
      {incident.solucion && (
        <p className={s.incidentSolution}>
          <strong>Solución confirmada:</strong> {incident.solucion}
          <small>
            Usuario #{incident.resueltoPorId ?? "—"}
            {incident.confirmadoPorRol
              ? ` · ${incident.confirmadoPorRol.toLowerCase()}`
              : ""} · {dateLabel(incident.fechaResolucion)}
          </small>
        </p>
      )}
      {canResolve && incident.estado === "ABIERTO" && (
        <div className={s.resolve}>
          <label className={s.solutionField}>
            <span>¿Cómo se solucionó?</span>
            <input
              className={s.field}
              aria-label={`Solución del incidente ${incident.id}`}
              placeholder="Describe la solución confirmada"
              value={solution}
              onChange={(e) => onSolution(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={s.primaryButton}
            disabled={busy || solution.trim().length < 3}
            onClick={onResolve}
          >
            Confirmar solución
          </button>
        </div>
      )}
    </section>
  );
}
