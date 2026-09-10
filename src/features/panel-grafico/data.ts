import { type JsonRecord, type PatioTrackCatalogItem, type MovementStatus, type IncidentSeverity, type IncidentRow, type MovementType, type MovementRow, type PanelData, type PanelRow, type HeaderEventTone, type HeaderEvent } from "./types";
import { patioTrackNumber, routeToTrackId, trackLabelFromId } from "./patio/model";

export async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

export function mapViaToPatioTrack(row: unknown): PatioTrackCatalogItem | null {
  const via = asRecord(row);
  const trackId = viaToTrackId(via);
  if (!trackId) return null;
  return {
    id: trackId,
    label: trackLabelFromVia(via, trackId),
    number: patioTrackNumber(trackId),
    sourceId: Number.isFinite(Number(via.id)) ? Number(via.id) : null,
  };
}

export function viaToTrackId(via: JsonRecord): string | null {
  const numero = Number(via.numero);
  if (Number.isFinite(numero) && numero > 0) return `VIA-${numero}`;
  return routeToTrackId(text(via.nombre, ""));
}

export function trackLabelFromVia(via: JsonRecord, trackId: string) {
  const name = text(via.nombre, "");
  if (name && name !== "-") {
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    if (normalized === "CIL") return "CIL";
    const viaNameMatch = /^VIA\s+(\d+)$/.exec(normalized);
    if (viaNameMatch) return viaNameMatch[1];
  }
  return trackLabelFromId(trackId);
}

export function dedupePatioTrackCatalog(rows: PatioTrackCatalogItem[]) {
  const byId = new Map<string, PatioTrackCatalogItem>();
  rows.forEach((row) => {
    if (!byId.has(row.id)) byId.set(row.id, row);
  });
  return Array.from(byId.values());
}

export function extractArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.rows)) return record.rows;
  return [];
}

export function text(value: unknown, fallback = "-") {
  const str = String(value ?? "").trim();
  return str || fallback;
}

export function formatLoco(value: unknown) {
  const raw = text(value, "");
  return raw ? raw.padStart(raw.length < 4 ? 4 : raw.length, "0") : "-";
}

export function equipmentLookupKey(value: unknown) {
  const raw = String(value ?? "").toUpperCase().replace(/^EQ\.?\s*/i, "").replace(/[^0-9A-Z]/g, "");
  return raw.replace(/^0+(?=\d)/, "") || raw;
}

export function isIncidentActiveStatus(value: unknown) {
  const raw = String(value ?? "").toUpperCase();
  return raw.includes("ABIERTO") || raw.includes("ACTIVO") || raw.includes("PROCESO") || raw.includes("PENDIENTE");
}

export function normalizeStatus(value: unknown): MovementStatus {
  const raw = String(value ?? "").toUpperCase().replace(/\s+/g, "_");
  if (raw.includes("DETEN") || raw.includes("CANCEL")) return "DETENIDO";
  if (raw.includes("PROCESO")) return "EN PROCESO";
  if (raw.includes("ESPERA")) return "EN ESPERA";
  if (raw.includes("SOLIC")) return "SOLICITADO";
  return "EN COLA";
}

export function normalizeSeverity(value: unknown): IncidentSeverity {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("CRIT")) return "CRITICO";
  if (raw.includes("ALTO") || raw.includes("ALTA") || raw.includes("URG")) return "ALTO";
  if (raw.includes("BAJO") || raw.includes("BAJA")) return "BAJO";
  return "MEDIO";
}

export function incidentSeverityRail(severity: IncidentSeverity) {
  if (severity === "CRITICO") return "bg-rose-600 shadow-[0_0_14px_rgba(225,29,72,.45)]";
  if (severity === "ALTO") return "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,.36)]";
  if (severity === "BAJO") return "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,.28)]";
  return "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,.32)]";
}

export function filterRecentIncidents(rows: IncidentRow[]) {
  const cutoff = Date.now() - 10 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => Number.isFinite(row.occurredAtMs) && row.occurredAtMs >= cutoff);
}

export function elapsedFrom(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days < 3 && remainingHours > 0) return `${days} d ${remainingHours} h`;
  if (days < 30) return `${days} d`;
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (months < 12) return remainingDays > 0 && months < 3 ? `${months} m ${remainingDays} d` : `${months} m`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0 && years < 3 ? `${years} a ${remainingMonths} m` : `${years} a`;
}

export function timestampFrom(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

export function normalizeMovementType(movement: JsonRecord): MovementType {
  if (movement.torno === true) return "Torno";
  if (movement.lavado === true) return "Lavado";
  return "Normal";
}

export function dedupeRowsByKey<T extends { key: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.key, row])).values());
}

export function sortIncidentsByState(rows: IncidentRow[]) {
  const severityRank: Record<IncidentSeverity, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAJO: 3 };
  return [...rows].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return severityRank[a.severity] - severityRank[b.severity];
  });
}

export function annotateRowsWithIncidents(rows: MovementRow[], incidents: IncidentRow[]) {
  const activeByEquipment = new Map<string, number>();
  incidents.forEach((incident) => {
    if (!incident.active || !incident.equipmentKey) return;
    activeByEquipment.set(incident.equipmentKey, (activeByEquipment.get(incident.equipmentKey) ?? 0) + 1);
  });

  return rows.map((row) => {
    const activeIncidentCount = activeByEquipment.get(equipmentLookupKey(row.equipment)) ?? 0;
    return {
      ...row,
      activeIncidentCount,
      signature: `${row.signature}|inc:${activeIncidentCount}`,
    };
  });
}

export function buildRowLookup(data: PanelData) {
  return new Map<string, PanelRow>([
    ...data.movements.map((row) => [row.key, row] as const),
    ...data.torneados.map((row) => [row.key, row] as const),
    ...data.incidents.map((row) => [row.key, row] as const),
  ]);
}

export function buildPanelSnapshots(data: PanelData) {
  const entries = [
    ...data.movements.map((row) => [row.key, row.signature] as const),
    ...data.torneados.map((row) => [row.key, row.signature] as const),
    ...data.incidents.map((row) => [row.key, row.signature] as const),
  ];
  const positions = new Map<string, number>();
  data.movements.forEach((row, index) => positions.set(row.key, index));
  data.torneados.forEach((row, index) => positions.set(row.key, index + 1000));
  data.incidents.forEach((row, index) => positions.set(row.key, index + 2000));
  return {
    signatures: new Map<string, string>(entries),
    positions,
    rows: buildRowLookup(data),
  };
}

export function isMovementRow(row: PanelRow | undefined): row is MovementRow {
  return Boolean(row && "equipment" in row && "route" in row && "type" in row && "status" in row);
}

export function isIncidentRow(row: PanelRow | undefined): row is IncidentRow {
  return Boolean(row && "severity" in row && "title" in row && "active" in row);
}

export function eventTimeLabel(value: number) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function movementEventTone(row: MovementRow): HeaderEventTone {
  if (row.type === "Torno") return "torno";
  if (row.type === "Lavado") return "lavado";
  return row.status === "EN PROCESO" || row.status === "DETENIDO" ? "state" : "movement";
}

export function movementEventBase(row: MovementRow) {
  return {
    detail: `${row.equipment} - ${row.type} - ${row.route} - ${row.company}`,
    subject: row.equipment,
    typeLabel: row.type,
    company: row.company,
  };
}

export function incidentEventBase(row: IncidentRow) {
  return {
    detail: `${row.id} - ${row.equipment} - ${row.title}`,
    subject: row.id,
    typeLabel: row.severity,
    company: row.equipment,
  };
}

export function buildRealtimeHeaderEvents({
  nextData,
  previousRows,
  previousSignatures,
  nextSignatures,
}: {
  nextData: PanelData;
  previousRows: Map<string, PanelRow>;
  previousSignatures: Map<string, string>;
  nextSignatures: Map<string, string>;
}) {
  const now = Date.now();
  const nextRows = buildRowLookup(nextData);
  const events: HeaderEvent[] = [];

  nextRows.forEach((row, key) => {
    const previousRow = previousRows.get(key);
    const previousSignature = previousSignatures.get(key);
    const nextSignature = nextSignatures.get(key);
    const wasCreated = !previousSignature;
    const wasUpdated = Boolean(previousSignature && previousSignature !== nextSignature);

    if (isIncidentRow(row) && (wasCreated || (wasUpdated && row.active))) {
      if (!row.active) return;
      events.push({
        key: `event:${now}:incident:${key}`,
        label: "Nuevo incidente",
        ...incidentEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "incident",
      });
      return;
    }

    if (!isMovementRow(row)) return;
    const previousMovement = isMovementRow(previousRow) ? previousRow : null;
    const isTorneado = key.startsWith("torneado:");

    if (wasCreated) {
      events.push({
        key: `event:${now}:created:${key}`,
        label: isTorneado ? "Nuevo torneo" : "Nuevo movimiento",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: movementEventTone(row),
      });
      return;
    }

    if (!isTorneado && row.status === "DETENIDO" && previousMovement?.status !== "DETENIDO") {
      events.push({
        key: `event:${now}:stopped:${key}`,
        label: "Nuevo detenido",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "state",
      });
      return;
    }

    if (!isTorneado && row.status === "EN PROCESO" && previousMovement?.status !== "EN PROCESO") {
      events.push({
        key: `event:${now}:started:${key}`,
        label: "Nuevo iniciado",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: movementEventTone(row),
      });
      return;
    }

    if (isTorneado && row.status === "EN PROCESO" && previousMovement?.status !== "EN PROCESO") {
      events.push({
        key: `event:${now}:torno-start:${key}`,
        label: "Nuevo torneo",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "torno",
      });
      return;
    }
  });

  previousRows.forEach((row, key) => {
    if (nextRows.has(key)) return;
    if (isMovementRow(row)) {
      const isTorneado = key.startsWith("torneado:");
      if (!isTorneado || row.status !== "EN PROCESO") return;
      events.push({
        key: `event:${now}:removed:${key}`,
        label: "Torneo finalizado",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "torno",
      });
    }
  });

  return events
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, 10);
}

export function buildHeaderEvents(data: PanelData): HeaderEvent[] {
  const now = Date.now();
  const incidentEvents = data.incidents.filter((incident) => incident.active).slice(0, 12).map((incident, index) => ({
    key: `ticker-${incident.key}`,
    label: "Nuevo incidente",
    ...incidentEventBase(incident),
    time: incident.time,
    occurredAtMs: incident.occurredAtMs || now - index * 60_000,
    tone: "incident" as HeaderEventTone,
  }));

  const movementEvents = data.movements.slice(0, 14).map((movement, index) => ({
    key: `ticker-${movement.key}`,
    label: movement.status === "DETENIDO" ? "Nuevo detenido" : movement.status === "EN PROCESO" ? "Nuevo iniciado" : "Nuevo movimiento",
    ...movementEventBase(movement),
    time: movement.time,
    occurredAtMs: movement.requestedAtMs || now - (index + 12) * 60_000,
    tone: movement.type === "Lavado" ? "lavado" as HeaderEventTone : movement.type === "Torno" ? "torno" as HeaderEventTone : "movement" as HeaderEventTone,
  }));

  const tornoEvents = data.torneados.slice(0, 12).map((torno, index) => ({
    key: `ticker-torno-${torno.key}`,
    label: torno.status === "EN PROCESO" ? "Nuevo torneo" : "Nuevo torneo",
    ...movementEventBase(torno),
    time: torno.time,
    occurredAtMs: torno.requestedAtMs || now - (index + 26) * 60_000,
    tone: "torno" as HeaderEventTone,
  }));

  return [...incidentEvents, ...movementEvents, ...tornoEvents]
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, 10);
}

export function mapMovement(row: unknown): MovementRow | null {
  const source = asRecord(row);
  const movement = asRecord(source.movimiento ?? source);
  const empresa = asRecord(source.empresa ?? movement.empresa);
  const viaOrigen = asRecord(movement.viaOrigen);
  const viaDestino = asRecord(movement.viaDestino);
  const localidad = asRecord(source.localidad);
  const stableId = movement.id ?? source.movimientoId ?? movement.movimientoId ?? source.id ?? source.rondaId ?? movement.rondaId;
  const origin = text(viaOrigen.nombre ?? movement.viaOrigenNombre ?? movement.origen ?? movement.viaOrigenId, "-");
  const destination = text(viaDestino.nombre ?? movement.viaDestinoNombre ?? movement.destino ?? movement.viaDestinoId, "-");
  const sourceKind = String(source.source ?? "").toLowerCase().includes("torno") ? "torneado" : "movement";
  const rondaNumero = Number(source.rondaNumero ?? source.ronda ?? 1) || 1;
  const orden = Number(source.orden ?? source.order ?? 0) || 0;
  const requestedAt = movement.fechaSolicitud ?? movement.createdAt ?? source.createdAt;

  const output = {
    key: `${sourceKind}:${stableId ?? `${movement.locomotiveNumber ?? movement.locomotora ?? "unknown"}:${rondaNumero}:${orden}`}`,
    equipment: formatLoco(movement.locomotiveNumber ?? movement.locomotora ?? movement.locomotoraNumero),
    company: text(empresa.nombre ?? movement.empresaNombre ?? source.empresaNombre ?? localidad.nombre, "Default"),
    route: `${origin} -> ${destination}`,
    origin,
    destination,
    type: normalizeMovementType(movement),
    status: normalizeStatus(movement.estado ?? source.estado),
    time: elapsedFrom(movement.fechaInicio ?? movement.fechaSolicitud ?? source.createdAt),
    requestedAtMs: timestampFrom(requestedAt),
    rondaNumero,
    orden,
    activeIncidentCount: 0,
  };
  return {
    ...output,
    signature: [
      output.equipment,
      output.company,
      output.route,
      output.type,
      output.status,
      output.time,
      output.requestedAtMs,
      source.rondaNumero,
      source.orden,
      movement.prioridad,
      movement.torno,
      movement.lavado,
      movement.fechaSolicitud,
      movement.fechaInicio,
      movement.fechaFin,
    ].join("|"),
  };
}

export function mapIncident(row: unknown): IncidentRow | null {
  const source = asRecord(row);
  const original = asRecord(source._original);
  const movement = asRecord(source.movimiento ?? original.movimiento);
  const id = source.incidenteId ?? source.id;
  const locomotive = source.locomotora ?? movement.locomotiveNumber ?? movement.locomotora ?? movement.locomotoraNumero;
  const rawStatus = text(source.estado ?? source.estatus, "ABIERTO");
  const occurredAt = source.fechaInicio ?? source.fechaISO ?? source.fecha ?? source.createdAt;
  const output = {
    key: `incident:${id ?? source.eventId ?? occurredAt ?? Math.random()}`,
    id: id ? `#${id}` : "#",
    severity: normalizeSeverity(source.prioridad ?? source.severidad ?? source.nivel ?? source.tipoIncidente),
    title: text(source.descripcion ?? source.motivo ?? source.tipoIncidente ?? source.titulo, "Incidente activo"),
    equipment: `Eq. ${formatLoco(locomotive)}`,
    equipmentKey: equipmentLookupKey(locomotive),
    time: elapsedFrom(occurredAt),
    occurredAtMs: timestampFrom(occurredAt),
    rawStatus,
    active: isIncidentActiveStatus(rawStatus),
  };
  return {
    ...output,
    signature: [
      output.id,
      output.severity,
      output.title,
      output.equipment,
      output.equipmentKey,
      output.time,
      output.occurredAtMs,
      output.rawStatus,
      output.active,
      source.fechaInicio,
      source.fechaResolucion,
      source.descripcion,
      source.motivo,
    ].join("|"),
  };
}
