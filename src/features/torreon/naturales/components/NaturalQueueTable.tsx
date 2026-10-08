"use client";
import { Fragment, useId, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Link2,
  UserRound,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";
import {
  configurationLabel,
  dateLabel,
  elapsedLabel,
  movementIncidents,
  personName,
  unitPriority,
  type QueueIncident,
  type QueueMovement,
  type QueuePhoto,
  type QueueUnit,
} from "../queueView";
import s from "./naturalQueue.module.scss";

type Props = {
  units: QueueUnit[];
  dispatch: boolean;
  selected: number[];
  onSelect: (id: number, checked: boolean) => void;
  operators: { id: number; nombre: string }[];
  busy: boolean;
  mutate: (path: string, body: unknown) => Promise<void>;
  onHistory: (id: number) => void;
};
const cleanInstructions = (text?: string | null) =>
  text?.replace(/\[META (?:ORIGEN|DESTINO):\d+\]\s*/gi, "").trim();
function timing(unit: QueueUnit, movement: QueueMovement) {
  const start = movement.fechaInicio ?? unit.fechaInicio;
  const finish = movement.fechaFin ?? unit.fechaFin;
  if (finish && start) return { label: "Inicio a fin", value: elapsedLabel(start, finish) };
  if (movement.fechaPausa && unit.estado === "DETENIDA")
    return { label: "Pausado hace", value: elapsedLabel(movement.fechaPausa) };
  if (start) return { label: "Desde inicio", value: elapsedLabel(start) };
  if (["CONCLUIDA", "CANCELADA"].includes(unit.estado))
    return { label: "Cierre", value: dateLabel(finish) };
  return {
    label: "En espera",
    value: elapsedLabel(movement.fechaSolicitud ?? unit.fechaRecepcion),
  };
}
export default function NaturalQueueTable({
  units,
  dispatch,
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
  const prefix = useId();
  const toggle = (id: number) =>
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  return (
    <div
      className={s.tableScroll}
      role="region"
      aria-label="Tabla de movimientos naturales"
      tabIndex={0}
    >
      <table className={s.table}>
        <caption className="sr-only">
          Movimientos naturales de Torreón en orden de atención. Los conjuntos conservan sus
          integrantes.
        </caption>
        <colgroup>
          <col className={s.orderCol} />
          <col className={s.locomotiveCol} />
          <col className={s.routeCol} />
          <col className={s.peopleCol} />
          <col className={s.statusCol} />
          <col className={s.configCol} />
          <col className={s.timeCol} />
          <col className={s.incidentCol} />
          <col className={s.actionCol} />
        </colgroup>
        <thead>
          <tr>
            {[
              "Orden",
              "Locomotora / empresa",
              "Origen → destino",
              "Responsables",
              "Estado",
              "Configuración",
              "Solicitud / tiempo",
              "Incidentes",
              "Detalle",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {units.map((unit, unitIndex) => (
          <tbody key={unit.id} data-group={unit.modalidad === "CONJUNTO"}>
            {unit.movimientos.map((movement, index) => {
              const incidents = movementIncidents(unit, movement);
              const openIncidents = incidents.filter((incident) => incident.estado === "ABIERTO");
              const isExpanded = expanded.includes(movement.id);
              const time = timing(unit, movement);
              const detailId = `${prefix}-movement-${movement.id}`;
              const coordinatorName = personName(
                movement.coordinador,
                movement.coordinadorId,
                "Por asignar",
              );
              const operatorName = personName(
                movement.operador ?? unit.operador,
                movement.operadorId ?? unit.operadorId,
              );
              return (
                <Fragment key={movement.id}>
                  <tr
                    className={s.movementRow}
                    data-selected={selected.includes(unit.id)}
                    data-expanded={isExpanded}
                    data-first={index === 0}
                  >
                    <td className={s.orderCell}>
                      {index === 0 ? (
                        <>
                          <div className={s.orderTop}>
                            {dispatch && unit.estado === "PENDIENTE" && (
                              <input
                                aria-label={`Seleccionar unidad ${unit.id}`}
                                type="checkbox"
                                disabled={busy}
                                checked={selected.includes(unit.id)}
                                onChange={(e) => onSelect(unit.id, e.target.checked)}
                              />
                            )}
                            <strong>
                              {String(unit.posicion ?? unitIndex + 1).padStart(2, "0")}
                            </strong>
                          </div>
                          <span className={s.orderHint}>{unitPriority(unit)}</span>
                        </>
                      ) : (
                        <span
                          className={s.continuation}
                          aria-label={`Mismo conjunto, posición ${unit.posicion ?? unitIndex + 1}`}
                        >
                          <Link2 size={17} aria-hidden />
                        </span>
                      )}
                      {unit.modalidad === "CONJUNTO" && (
                        <span className={s.groupTag}>
                          Conjunto #{unit.id}
                          <small>
                            {unit.totalIntegrantes &&
                            unit.totalIntegrantes > unit.movimientos.length
                              ? `${unit.movimientos.length} de ${unit.totalIntegrantes} visibles`
                              : `${index + 1} / ${unit.movimientos.length}`}
                          </small>
                        </span>
                      )}
                    </td>
                    <th scope="row" className={s.locomotiveCell}>
                      <strong>{movement.locomotiveNumber}</strong>
                      <span className={s.company}>
                        {movement.empresaNombreSnapshot || `Empresa #${movement.empresaId}`}
                      </span>
                      <small>
                        Movimiento #{movement.id}
                        {unit.modalidad !== "CONJUNTO" ? ` · Solicitud #${unit.id}` : ""}
                      </small>
                    </th>
                    <td>
                      <div className={s.route}>
                        <span className={s.routeOrigin}>
                          <span className={s.routeDot} />
                          <span>
                            <strong>
                              {movement.viaOrigenNombreSnapshot ??
                                (movement.viaOrigenId
                                  ? `Vía #${movement.viaOrigenId}`
                                  : "Origen sin registrar")}
                            </strong>
                            {movement.seccionOrigenNombreSnapshot && (
                              <small>{movement.seccionOrigenNombreSnapshot}</small>
                            )}
                          </span>
                        </span>
                        <ArrowDown size={13} className={s.routeArrow} aria-hidden />
                        <span className={s.routeDestination}>
                          <span className={s.routeDot} />
                          <span>
                            <strong>
                              {movement.viaDestinoNombreSnapshot ??
                                (movement.viaDestinoId
                                  ? `Vía #${movement.viaDestinoId}`
                                  : "Destino sin registrar")}
                            </strong>
                            {movement.seccionDestinoNombreSnapshot && (
                              <small>{movement.seccionDestinoNombreSnapshot}</small>
                            )}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={s.person}>
                        <span>Coordinador</span>
                        <strong
                          className={
                            !movement.coordinadorId && !movement.coordinador
                              ? s.unassigned
                              : undefined
                          }
                        >
                          {coordinatorName}
                        </strong>
                      </div>
                      <div className={s.person}>
                        <span>Maquinista</span>
                        <strong
                          className={
                            !movement.operadorId && !unit.operadorId ? s.unassigned : undefined
                          }
                        >
                          {operatorName}
                        </strong>
                      </div>
                    </td>
                    <td>
                      <div className={s.statusStack}>
                        <StatusBadge status={movement.estado} size="sm" dot />
                        {unit.estado === "LISTA_REANUDAR" && (
                          <span className={s.readyTag}>Lista para reanudar</span>
                        )}
                        {unit.ordenManual != null && unit.estado === "PENDIENTE" && (
                          <span className={s.priorityTag}>Prioridad manual</span>
                        )}
                        {unit.incidenteBloqueanteId && unit.estado !== "DETENIDA" && (
                          <span className={s.blockedTag}>Ruta bloqueada</span>
                        )}
                        <span className={s.photoCount}>
                          <Camera size={13} aria-hidden />
                          {movement.fotos?.length
                            ? `${movement.fotos.length} ${movement.fotos.length === 1 ? "foto" : "fotos"}`
                            : "Sin fotos"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong className={s.movementType}>
                        {configurationLabel(movement.tipoMovimiento)}
                      </strong>
                      {movement.tipoMovimiento === "REMOLCADA" && (
                        <p className={s.towing}>
                          Remolca {movement.locomotoraRemolque ?? "—"} ·{" "}
                          {configurationLabel(movement.direccionEmpuje)}
                        </p>
                      )}
                      <dl className={s.configuration}>
                        <div>
                          <dt>Polo</dt>
                          <dd>{configurationLabel(movement.polo)}</dd>
                        </div>
                        <div>
                          <dt>Chimenea</dt>
                          <dd>{configurationLabel(movement.posicionChimenea)}</dd>
                        </div>
                        <div>
                          <dt>Cabina</dt>
                          <dd>{configurationLabel(movement.posicionCabina)}</dd>
                        </div>
                      </dl>
                    </td>
                    <td className={s.timeCell}>
                      <time dateTime={movement.fechaSolicitud ?? unit.fechaRecepcion ?? undefined}>
                        {dateLabel(movement.fechaSolicitud ?? unit.fechaRecepcion)}
                      </time>
                      <span>{time.label}</span>
                      <strong>{time.value}</strong>
                    </td>
                    <td>
                      <div className={s.incidentsSummary}>
                        {openIncidents.length ? (
                          <button
                            type="button"
                            className={s.incidentButton}
                            onClick={() => {
                              if (!isExpanded) toggle(movement.id);
                            }}
                            aria-label={`Ver incidentes del movimiento ${movement.id}`}
                          >
                            <AlertTriangle size={14} aria-hidden />
                            {openIncidents.length}{" "}
                            {openIncidents.length === 1 ? "abierto" : "abiertos"}
                          </button>
                        ) : unit.incidenteBloqueanteId ? (
                          <button
                            type="button"
                            className={s.incidentButton}
                            onClick={() => {
                              if (!isExpanded) toggle(movement.id);
                            }}
                          >
                            Bloqueo #{unit.incidenteBloqueanteId}
                          </button>
                        ) : (
                          <span className={s.noIncidents}>
                            {incidents.length ? "Resueltos" : "Sin incidentes"}
                          </span>
                        )}
                        {openIncidents[0] && (
                          <span className={s.incidentReason} title={openIncidents[0].motivo}>
                            #{openIncidents[0].id} · {openIncidents[0].motivo}
                          </span>
                        )}
                        {!openIncidents.length && incidents.length > 0 && (
                          <small>{incidents.length} en historial</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={s.detailButton}
                        aria-label={`${isExpanded ? "Ocultar" : "Ver"} detalle del movimiento ${movement.id}`}
                        aria-expanded={isExpanded}
                        aria-controls={isExpanded ? detailId : undefined}
                        onClick={() => toggle(movement.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp size={16} aria-hidden />
                        ) : (
                          <ChevronDown size={16} aria-hidden />
                        )}
                        {isExpanded ? "Cerrar" : "Detalle"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={s.detailRow}>
                      <td colSpan={9} id={detailId}>
                        <div className={s.detailHeader}>
                          <strong>
                            Movimiento #{movement.id} · Locomotora {movement.locomotiveNumber}
                          </strong>
                          <button
                            type="button"
                            className={s.textButton}
                            onClick={() => onHistory(unit.id)}
                          >
                            <History size={15} aria-hidden /> Ver historial de operación
                          </button>
                        </div>
                        <div className={s.detailGrid}>
                          <div>
                            <h3>Indicaciones</h3>
                            <p className={s.instructions}>
                              {cleanInstructions(movement.instrucciones) ||
                                "Sin indicaciones adicionales."}
                            </p>
                            {unit.modalidad === "CONJUNTO" && (
                              <p className={s.groupNote}>
                                <Link2 size={14} aria-hidden />
                                Parte del conjunto #{unit.id}, con{" "}
                                {unit.totalIntegrantes ?? unit.movimientos.length} movimientos.{" "}
                                {unit.totalIntegrantes &&
                                unit.totalIntegrantes > unit.movimientos.length
                                  ? `Se muestran ${unit.movimientos.length} de tu empresa.`
                                  : ""}
                              </p>
                            )}
                          </div>
                          <div>
                            <h3>Participantes</h3>
                            <dl className={s.detailData}>
                              <div>
                                <dt>Solicitante</dt>
                                <dd>
                                  {personName(
                                    movement.creadoPor,
                                    movement.creadoPorId,
                                    "Sin registrar",
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>Cliente</dt>
                                <dd>
                                  {personName(
                                    movement.cliente ??
                                      (movement.clienteId === movement.creadoPorId
                                        ? movement.creadoPor
                                        : null),
                                    movement.clienteId,
                                    "Sin registrar",
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>Supervisor</dt>
                                <dd>{personName(movement.supervisor, movement.supervisorId)}</dd>
                              </div>
                            </dl>
                          </div>
                          <div>
                            <h3>Tiempos de operación</h3>
                            <dl className={s.detailData}>
                              <div>
                                <dt>Inicio</dt>
                                <dd>{dateLabel(movement.fechaInicio ?? unit.fechaInicio)}</dd>
                              </div>
                              <div>
                                <dt>Fin</dt>
                                <dd>{dateLabel(movement.fechaFin ?? unit.fechaFin)}</dd>
                              </div>
                              <div>
                                <dt>Pausa</dt>
                                <dd>{dateLabel(movement.fechaPausa)}</dd>
                              </div>
                              {unit.fechaHabilitacion && (
                                <div>
                                  <dt>Reanudación habilitada</dt>
                                  <dd>{dateLabel(unit.fechaHabilitacion)}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        </div>
                        {dispatch &&
                          !["EN_PROCESO", "CONCLUIDA", "CANCELADA"].includes(unit.estado) && (
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
                                  setAssignment((prev) => ({ ...prev, [unit.id]: e.target.value }))
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
                        {unit.incidenteBloqueanteId &&
                          !incidents.some(
                            (incident) => incident.id === unit.incidenteBloqueanteId,
                          ) && (
                            <div className={s.routeBlock}>
                              <AlertTriangle size={17} aria-hidden />
                              Ruta bloqueada por el incidente #{unit.incidenteBloqueanteId}. La
                              solicitud requiere la solución del bloqueo para continuar.
                            </div>
                          )}
                        {incidents.map((incident) => (
                          <IncidentDetail
                            key={incident.id}
                            incident={incident}
                            busy={busy}
                            solution={solution[incident.id] ?? ""}
                            onSolution={(value) =>
                              setSolution((prev) => ({ ...prev, [incident.id]: value }))
                            }
                            onResolve={() =>
                              void mutate(`/incidentes/${incident.id}/resolver?tipo=NATURAL`, {
                                solucion: solution[incident.id],
                              })
                            }
                          />
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        ))}
      </table>
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
  busy,
  solution,
  onSolution,
  onResolve,
}: {
  incident: QueueIncident;
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
      {incident.fotos?.length ? (
        <PhotoLinks photos={incident.fotos} />
      ) : (
        <p className={s.muted}>Sin fotografías del incidente.</p>
      )}
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
      {incident.estado === "ABIERTO" && (
        <div className={s.resolve}>
          <input
            className={s.field}
            aria-label={`Solución del incidente ${incident.id}`}
            placeholder="Describe la solución confirmada"
            value={solution}
            onChange={(e) => onSolution(e.target.value)}
          />
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
