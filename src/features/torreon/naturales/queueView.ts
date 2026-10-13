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
  seccionOrigenNumero?: number | null;
  seccionDestinoNumero?: number | null;
  viaOrigenNombreSnapshot?: string | null;
  viaDestinoNombreSnapshot?: string | null;
  seccionOrigenNombreSnapshot?: string | null;
  seccionDestinoNombreSnapshot?: string | null;
  polo?: string | null;
  poloOrigen?: string | null;
  poloDestino?: string | null;
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
  tiempoActivoSegundos?: number | null;
  tiempoActivoEstimado?: boolean;
  tiempoTotalSegundos?: number | null;
  tiempoCalculadoEn?: string | null;
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

/** Section numbers come from the catalog/API, never from database identifiers. */
export function poleLabel(value?: string | null) {
  return value === "NORTE"
    ? "Norte"
    : value === "CENTRO"
      ? "Centro"
      : value === "SUR"
        ? "Sur"
        : "No registrado";
}

export function sectionPositionLabel(
  numero?: number | null,
  snapshot?: string | null,
  hasSection = false,
) {
  const name = snapshot?.trim() || "";
  const explicit = name.match(/^secci[oó]n\s+([1-9]\d*)\b(?:\s*[·:\-]\s*(.*))?$/i);
  const verifiedNumber = typeof numero === "number" && Number.isInteger(numero) && numero > 0;
  if (verifiedNumber || explicit) {
    const value = verifiedNumber ? numero : Number(explicit![1]);
    const base = `Sección ${value}`;
    const detail = explicit ? explicit[2]?.trim() || "" : name;
    return detail && detail !== String(value) ? `${base} · ${detail}` : base;
  }
  if (name && !/^secci[oó]n\s*#/i.test(name)) return `Sección sin número · ${name}`;
  return hasSection ? "Número de sección no disponible" : "Sin sección especificada";
}

export function queueUnitLabel(unit: QueueUnit) {
  if (unit.modalidad === "CONJUNTO") return `Conjunto #${unit.id}`;
  const movement = unit.movimientos[0];
  return movement ? `Solicitud #${movement.id}` : `Operación #${unit.id}`;
}

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
  dates?: { field: "solicitud" | "inicio" | "fin"; from: string; to: string },
) {
  const query = normalize(search.trim());
  return units.filter((unit) => {
    if (dates && (dates.from || dates.to)) {
      if (dates.from && dates.to && dates.from > dates.to) return false;
      const field = {
        solicitud: "fechaSolicitud",
        inicio: "fechaInicio",
        fin: "fechaFin",
      } as const;
      const fallback = {
        solicitud: unit.fechaRecepcion,
        inicio: unit.fechaInicio,
        fin: unit.fechaFin,
      };
      if (
        !unit.movimientos.some((movement) => {
          const value = movement[field[dates.field]] ?? fallback[dates.field];
          const stamp = value ? new Date(value) : null;
          if (!stamp || !Number.isFinite(stamp.getTime())) return false;
          const parts = new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "America/Monterrey",
          }).formatToParts(stamp);
          const part = (type: string) => parts.find((item) => item.type === type)?.value;
          const day = `${part("year")}-${part("month")}-${part("day")}`;
          return (!dates.from || day >= dates.from) && (!dates.to || day <= dates.to);
        })
      )
        return false;
    }
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
          sectionPositionLabel(
            m.seccionOrigenNumero,
            m.seccionOrigenNombreSnapshot,
            Boolean(m.seccionOrigenId),
          ),
          sectionPositionLabel(
            m.seccionDestinoNumero,
            m.seccionDestinoNombreSnapshot,
            Boolean(m.seccionDestinoId),
          ),
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
  return durationLabel((end - start) / 1000);
}
export function durationLabel(seconds: number) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  if (minutes < 1) return "Menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
}
export function naturalTiming(unit: QueueUnit, movement: QueueMovement, now = Date.now()) {
  const start = movement.fechaInicio ?? unit.fechaInicio;
  const finish = movement.fechaFin ?? unit.fechaFin;
  const active = movement.tiempoActivoSegundos;
  if (start && typeof active === "number" && Number.isFinite(active) && active >= 0) {
    const calculatedAt = movement.tiempoCalculadoEn ? Date.parse(movement.tiempoCalculadoEn) : NaN;
    const running = movement.estado === "EN_PROCESO" && unit.estado === "EN_PROCESO" && !finish;
    const extra =
      running && Number.isFinite(calculatedAt) ? Math.max(0, (now - calculatedAt) / 1000) : 0;
    return {
      label: movement.tiempoActivoEstimado ? "Trabajo efectivo aprox." : "Trabajo efectivo",
      value: durationLabel(active + extra),
      total: elapsedLabel(start, finish ?? new Date(now).toISOString()),
    };
  }
  if (finish && start) return { label: "Tiempo total", value: elapsedLabel(start, finish) };
  if (movement.fechaPausa && unit.estado === "DETENIDA")
    return {
      label: "Pausado hace",
      value: elapsedLabel(movement.fechaPausa, new Date(now).toISOString()),
    };
  if (start)
    return {
      label: "Tiempo total",
      value: elapsedLabel(start, new Date(now).toISOString()),
    };
  if (["CONCLUIDA", "CANCELADA"].includes(unit.estado))
    return { label: "Cierre", value: dateLabel(finish) };
  return {
    label: "En espera",
    value: elapsedLabel(
      movement.fechaSolicitud ?? unit.fechaRecepcion,
      new Date(now).toISOString(),
    ),
  };
}
export function movementIncidents(unit: QueueUnit, movement: QueueMovement) {
  const rows = [
    ...(movement.incidentes ?? []),
    ...unit.incidentes.filter((i) => i.movimientoId == null || i.movimientoId === movement.id),
  ];
  return rows.filter((row, index) => rows.findIndex((i) => i.id === row.id) === index);
}
