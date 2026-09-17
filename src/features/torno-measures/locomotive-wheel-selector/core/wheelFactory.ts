import { WheelCount, WheelData, WheelOverride, WheelSide, WheelStatus } from "./types";

export function getAxleCount(wheelCount: WheelCount): number {
  return wheelCount / 2;
}

export function getWheelId(axleIndex: number, side: WheelSide): string {
  return `A${axleIndex}-${side === "left" ? "L" : "R"}`;
}

export function getWheelLabel(axleIndex: number, side: WheelSide): string {
  return `Eje ${axleIndex} / ${side === "left" ? "Izquierda" : "Derecha"}`;
}

export function createDefaultWheel(
  axleIndex: number,
  side: WheelSide,
  status: WheelStatus = "available",
): WheelData {
  return {
    id: getWheelId(axleIndex, side),
    axleIndex,
    side,
    label: getWheelLabel(axleIndex, side),
    status,
  };
}

export function normalizeWheels(
  wheelCount: WheelCount,
  overrides: WheelOverride[] = [],
): WheelData[] {
  const axleCount = getAxleCount(wheelCount);
  const overrideById = new Map(overrides.map((item) => [item.id, item]));
  const result: WheelData[] = [];

  for (let axleIndex = 1; axleIndex <= axleCount; axleIndex += 1) {
    (["left", "right"] as WheelSide[]).forEach((side) => {
      const id = getWheelId(axleIndex, side);
      const base = createDefaultWheel(axleIndex, side);
      const override = overrideById.get(id);

      result.push({
        ...base,
        ...(override ?? {}),
        id,
        axleIndex,
        side,
        label: override?.label ?? base.label,
        status: override?.status ?? base.status,
      });
    });
  }

  return result;
}
