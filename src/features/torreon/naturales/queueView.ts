export type QueuePerson = { id?: number; nombre: string; rol?: string };
export type QueuePhoto = {
  id?: number;
  url: string;
  tipo?: string;
  tomadaAt?: string | null;
  comentario?: string | null;
};
export type QueueIncident = {
  id: number;
  movimientoId?: number | null;
  estado: string;
  motivo: string;
  solucion?: string | null;
  fechaInicio: string;
  fotos?: QueuePhoto[];
  confirmadoPorRol?: string | null;
  resueltoPorId?: number | null;
  fechaResolucion?: string | null;
};
export type QueueMovement = {
  id: number;
  empresaId: number;
  empresaNombreSnapshot?: string | null;
  localidadNombreSnapshot?: string | null;
  locomotiveNumber: number;
  locomotoraRemolque?: number | null;
  viaOrigenId?: number | null;
  viaDestinoId?: number | null;
  seccionOrigenId?: number | null;
  seccionDestinoId?: number | null;
  viaOrigenNombreSnapshot?: string | null;
  viaDestinoNombreSnapshot?: string | null;
  seccionOrigenNombreSnapshot?: string | null;
  seccionDestinoNombreSnapshot?: string | null;
  polo?: string | null;
  posicionCabina?: string | null;
  posicionChimenea?: string | null;
  tipoMovimiento?: string | null;
  direccionEmpuje?: string | null;
  instrucciones?: string | null;
  estado: string;
  coordinadorId?: number | null;
  coordinador?: QueuePerson | null;
  supervisorId?: number | null;
  supervisor?: QueuePerson | null;
  operadorId?: number | null;
  operador?: QueuePerson | null;
  creadoPorId?: number | null;
  creadoPor?: QueuePerson | null;
  clienteId?: number | null;
  cliente?: QueuePerson | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechaPausa?: string | null;
  fotos?: QueuePhoto[];
  incidentes?: QueueIncident[];
};
export type QueueUnit = {
  id: number;
  modalidad: string;
  estado: string;
  operadorId: number | null;
  operador?: QueuePerson | null;
  disponible: boolean;
  posicion: number;
  fechaRecepcion?: string | null;
  fechaHabilitacion?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  ordenManual: number | null;
  totalIntegrantes?: number;
  movimientos: QueueMovement[];
  incidentes: QueueIncident[];
  incidenteBloqueanteId?: number | null;
};
export type QueueAudit = {
  id: number;
  unidadId?: number | null;
  movimientoId?: number | null;
  incidenteId?: number | null;
  fecha: string;
  accion: string;
  usuarioId: number;
  rol?: string;
  datos?: Record<string, unknown> | null;
};

export function personName(person?: QueuePerson | null, id?: number | null, empty = "Sin asignar") {
  return person?.nombre || (id ? `Usuario #${id}` : empty);
}
export function configurationLabel(value?: string | null) {
  if (!value || value.toUpperCase() === "SIN_SOLICITAR") return "Sin solicitar";
  const labels: Record<string, string> = {
    MD_TRABAJANDO: "MD trabajando",
    REMOLCADA: "Remolcada",
    NORTE: "Norte",
    SUR: "Sur",
    DENTRO: "Dentro",
    AFUERA: "Afuera",
    EMPUJAR: "Empujar",
    JALAR: "Jalar",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}
export function unitPriority(unit: QueueUnit) {
  if (unit.estado === "LISTA_REANUDAR") return "Reanudación";
  if (unit.estado === "DETENIDA") return "Detenida";
  if (unit.estado === "EN_PROCESO") return "En atención";
  if (unit.estado === "CONCLUIDA") return "Concluida";
  if (unit.estado === "CANCELADA") return "Cancelada";
  return unit.ordenManual != null ? "Prioridad manual" : "Por llegada";
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function filterQueue(
  units: QueueUnit[],
  search: string,
  state: string,
  coordinator: string,
) {
  const query = normalize(search.trim());
  return units.filter((unit) => {
    if (state && unit.estado !== state) return false;
    if (
      coordinator &&
      !unit.movimientos.some(
        (m) => String(m.coordinadorId ?? m.coordinador?.id ?? "") === coordinator,
      )
    )
      return false;
    if (!query) return true;
    return normalize(
      [
        unit.id,
        unit.operador?.nombre,
        unitPriority(unit),
        ...unit.movimientos.flatMap((m) => [
          m.id,
          m.locomotiveNumber,
          m.locomotoraRemolque,
          m.empresaNombreSnapshot,
          m.viaOrigenNombreSnapshot,
          m.viaDestinoNombreSnapshot,
          m.seccionOrigenNombreSnapshot,
          m.seccionDestinoNombreSnapshot,
          m.coordinador?.nombre,
          m.operador?.nombre,
          m.supervisor?.nombre,
          m.creadoPor?.nombre,
          m.instrucciones,
        ]),
      ]
        .filter((value) => value != null)
        .join(" "),
    ).includes(query);
  });
}
export function dateLabel(value?: string | null, options?: { seconds?: boolean }) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(options?.seconds ? { second: "2-digit" as const } : {}),
    hour12: false,
    timeZone: "America/Monterrey",
  }).format(date);
}
export function elapsedLabel(from?: string | null, to?: string | null) {
  if (!from) return "—";
  const start = new Date(from).getTime(),
    end = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  if (minutes < 1) return "Menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
}
export function movementIncidents(unit: QueueUnit, movement: QueueMovement) {
  const rows = [
    ...(movement.incidentes ?? []),
    ...unit.incidentes.filter((i) => i.movimientoId == null || i.movimientoId === movement.id),
  ];
  return rows.filter((row, index) => rows.findIndex((i) => i.id === row.id) === index);
}
