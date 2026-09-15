import { type PatioTrackDefinition, type MovementRow, type PatioTrackCatalogItem, type PatioTrack, type PatioPlacement, type MovementType, type PatioServiceActivity, type MovementStatus, type PatioLocomotiveStatus, type PatioStagingLocomotive, type PatioStagingKind } from "../types";

export const PATIO_TRACK_START_ANGLE = 189;

export const PATIO_TRACK_END_ANGLE = 348;

export const PATIO_BASE_TRACKS: PatioTrackDefinition[] = [
  { id: "CIL", label: "CIL", angle: 189 },
  { id: "VIA-10", label: "10", angle: 207 },
  { id: "VIA-25", label: "25", angle: 225 },
  { id: "VIA-7", label: "7", angle: 243 },
  { id: "VIA-6", label: "6", angle: 261 },
  { id: "VIA-5", label: "5", angle: 279 },
  { id: "VIA-4", label: "4", angle: 297 },
  { id: "VIA-3", label: "3", angle: 315 },
  { id: "VIA-2", label: "2", angle: 333 },
  { id: "VIA-1", label: "1", angle: 348 },
];

export const PATIO_BASE_LABELS = new Map(PATIO_BASE_TRACKS.map((track) => [track.id, track.label]));

export function buildPatioTracks(movements: MovementRow[], catalog: PatioTrackCatalogItem[]): PatioTrack[] {
  const trackDefinitions = buildPatioTrackDefinitions(movements, catalog);
  const assigned = new Map<string, Array<{ movement: MovementRow; placement: PatioPlacement; originTrackId: string | null; destinationTrackId: string | null }>>();
  movements.forEach((movement) => {
    const placement = movementPatioPlacement(movement);
    if (!placement.trackId) return;
    if (placement.placement === "destination" && !placement.originTrackId) return;

    const current = assigned.get(placement.trackId) ?? [];
    if (current.length >= 3) return;
    current.push({ movement, ...placement });
    assigned.set(placement.trackId, current);
  });

  return trackDefinitions.map((track) => {
    const assignments = assigned.get(track.id) ?? [];
    const mainAssignment = assignments[0] ?? null;
    const movement = mainAssignment?.movement ?? null;
    const status = movement ? toPatioStatus(movement.status) : "waiting";
    const mode = assignments.some((item) => item.movement.status === "DETENIDO")
      ? "blocked"
      : assignments.some((item) => item.movement.status === "EN PROCESO")
        ? "entry"
        : "idle";
    const locomotives = assignments.map(({ movement: itemMovement, ...itemPlacement }) => ({
      key: itemMovement.key,
      number: itemMovement.equipment,
      status: toPatioStatus(itemMovement.status),
      type: itemMovement.type,
      activeIncidentCount: itemMovement.activeIncidentCount,
      placement: itemPlacement.placement,
      originTrackId: itemPlacement.originTrackId,
      destinationTrackId: itemPlacement.destinationTrackId,
    }));
    return {
      ...track,
      mode,
      originTrackId: mainAssignment?.originTrackId ?? null,
      destinationTrackId: mainAssignment?.destinationTrackId ?? null,
      placement: mainAssignment?.placement ?? null,
      locomotive: movement
        ? {
            key: movement.key,
            number: movement.equipment,
            status,
            type: movement.type,
            activeIncidentCount: movement.activeIncidentCount,
            placement: mainAssignment?.placement ?? null,
            originTrackId: mainAssignment?.originTrackId ?? null,
            destinationTrackId: mainAssignment?.destinationTrackId ?? null,
          }
        : null,
      locomotives,
    };
  });
}

export function buildPatioStagingLocomotives(movements: MovementRow[]): PatioStagingLocomotive[] {
  return movements
    .map((movement) => {
      const placement = movementPatioPlacement(movement);
      const flow = patioMovementFlow(movement, placement);
      if (!flow || (flow.stageKind === "yard-transfer" && placement.originTrackId && placement.destinationTrackId)) return null;
      if (placement.originTrackId && placement.destinationTrackId && placement.originTrackId !== placement.destinationTrackId) return null;
      return {
        key: movement.key,
        number: movement.equipment,
        status: toPatioStatus(movement.status),
        type: movement.type,
        activeIncidentCount: movement.activeIncidentCount,
        placement: "destination" as const,
        originTrackId: placement.originTrackId,
        destinationTrackId: placement.destinationTrackId,
        originLabel: flow.originLabel,
        destinationLabel: flow.destinationLabel,
        stageLabel: flow.stageLabel,
        stageKind: flow.stageKind,
      };
    })
    .filter(Boolean) as PatioStagingLocomotive[];
}

export function isExternalFlowMovement(movement: MovementRow) {
  return patioMovementFlow(movement) !== null;
}

export function buildPatioTrackDefinitions(movements: MovementRow[], catalog: PatioTrackCatalogItem[]): PatioTrackDefinition[] {
  const tracks = new Map<string, PatioTrackDefinition>();
  const addTrack = (trackId: string | null) => {
    if (!trackId || tracks.has(trackId)) return;
    tracks.set(trackId, {
      id: trackId,
      label: trackLabelFromId(trackId),
      angle: 0,
    });
  };

  PATIO_BASE_TRACKS.forEach((track) => tracks.set(track.id, { ...track }));
  catalog.forEach((track) => {
    tracks.set(track.id, {
      id: track.id,
      label: track.label,
      angle: 0,
    });
  });
  movements.forEach((movement) => {
    addTrack(routeToTrackId(movement.origin));
    addTrack(routeToTrackId(movement.destination));
  });

  const ordered = Array.from(tracks.values()).sort(comparePatioTrackDefinitions);
  const angleStep =
    ordered.length > 1 ? (PATIO_TRACK_END_ANGLE - PATIO_TRACK_START_ANGLE) / (ordered.length - 1) : 0;

  return ordered.map((track, index) => ({
    ...track,
    angle: PATIO_TRACK_START_ANGLE + angleStep * index,
  }));
}

export function comparePatioTrackDefinitions(left: PatioTrackDefinition, right: PatioTrackDefinition) {
  if (left.id === "CIL") return -1;
  if (right.id === "CIL") return 1;

  const leftNumber = patioTrackNumber(left.id);
  const rightNumber = patioTrackNumber(right.id);
  if (leftNumber !== null && rightNumber !== null) return rightNumber - leftNumber;
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left.label.localeCompare(right.label);
}

export function patioTrackNumber(trackId: string): number | null {
  const match = /^VIA-(\d+)$/.exec(trackId);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function trackLabelFromId(trackId: string) {
  const baseLabel = PATIO_BASE_LABELS.get(trackId);
  if (baseLabel) return baseLabel;
  const via = patioTrackNumber(trackId);
  if (via !== null) return String(via);
  return trackId.replace(/-/g, " ");
}

export function movementPatioPlacement(movement: MovementRow): {
  trackId: string | null;
  placement: PatioPlacement;
  originTrackId: string | null;
  destinationTrackId: string | null;
} {
  const originTrackId = routeToTrackId(movement.origin);
  const destinationTrackId = routeToTrackId(movement.destination);

  if (originTrackId && destinationTrackId) {
    return {
      trackId: originTrackId,
      placement: originTrackId === destinationTrackId ? "origin" : "both",
      originTrackId,
      destinationTrackId,
    };
  }

  if (originTrackId) return { trackId: originTrackId, placement: "origin", originTrackId, destinationTrackId };
  return { trackId: destinationTrackId, placement: "destination", originTrackId, destinationTrackId };
}

export function patioMovementFlow(
  movement: MovementRow,
  placement = movementPatioPlacement(movement)
): { originLabel: string; destinationLabel: string; stageLabel: string; stageKind: PatioStagingKind } | null {
  const originExternal = routeToExternalOriginLabel(movement.origin);
  const destinationSpecial = routeToSpecialLabel(movement.destination);
  const originLabel = placement.originTrackId
    ? `Via ${trackLabelFromId(placement.originTrackId)}`
    : originExternal ?? serviceOriginLabel(movement) ?? "Exterior";
  const destinationLabel = placement.destinationTrackId
    ? `Via ${trackLabelFromId(placement.destinationTrackId)}`
    : destinationSpecial ?? movement.destination ?? "Exterior";

  if (originExternal) {
    return { originLabel, destinationLabel, stageLabel: "Patio externo", stageKind: "yard-transfer" };
  }

  if (movement.type !== "Normal" && !placement.originTrackId && placement.destinationTrackId) {
    return { originLabel, destinationLabel, stageLabel: "Salida servicio", stageKind: "service-exit" };
  }

  if (!placement.originTrackId && placement.destinationTrackId) {
    return { originLabel, destinationLabel, stageLabel: "Pre-ingreso", stageKind: "pre-entry" };
  }

  return null;
}

export function routeToTrackId(route: string): string | null {
  const rawOrigin = String(route ?? "").split("->")[0]?.trim() ?? "";
  const normalized = rawOrigin
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/VIA/g, "")
    .replace(/[^0-9A-Z]/g, "");
  if (!normalized) return null;
  if (normalized === "CIL") return "CIL";
  const via = Number(normalized);
  if (!Number.isFinite(via)) return null;
  return `VIA-${via}`;
}

export function routeToSpecialLabel(route: string): string | null {
  const normalized = String(route ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "-") return null;
  if (normalized.includes("TORNO") || normalized.includes("TORNE")) return "Torno";
  if (normalized.includes("LAVADO")) return "Lavado";
  if (normalized.includes("MESA")) return "Mesa giratoria";
  if (normalized.includes("COMBUST")) return "Combustible";
  if (normalized.includes("PALMA")) return "Palma";
  return null;
}

export function routeToExternalOriginLabel(route: string): string | null {
  const label = routeToSpecialLabel(route);
  return label === "Mesa giratoria" || label === "Combustible" || label === "Palma" ? label : null;
}

export function serviceOriginLabel(movement: MovementRow) {
  if (movement.type === "Torno") return "Torno";
  if (movement.type === "Lavado") return "Lavado";
  return null;
}

export function serviceDestinationLabel(movement: MovementRow) {
  if (movement.type === "Torno") return "Torno";
  if (movement.type === "Lavado") return "Lavado";
  return null;
}

export function buildServiceActivity(rows: MovementRow[], type: MovementType): PatioServiceActivity {
  const queue = rows
    .filter((row) => row.type === type)
    .sort((left, right) => serviceStatusRank(left.status) - serviceStatusRank(right.status))
    .slice(0, 5)
    .map((row) => ({
      number: row.equipment,
      status: toPatioStatus(row.status),
      type: row.type,
    }));
  const active = queue[0];
  return active ? { ...active, queue } : null;
}

export function serviceStatusRank(status: MovementStatus) {
  if (status === "EN PROCESO") return 0;
  if (status === "EN COLA" || status === "SOLICITADO" || status === "EN ESPERA") return 1;
  if (status === "DETENIDO") return 2;
  return 3;
}

export function toPatioStatus(status: MovementStatus): PatioLocomotiveStatus {
  if (status === "DETENIDO") return "stopped";
  if (status === "EN PROCESO") return "moving";
  if (status === "EN ESPERA" || status === "EN COLA" || status === "SOLICITADO") return "waiting";
  return "operating";
}
