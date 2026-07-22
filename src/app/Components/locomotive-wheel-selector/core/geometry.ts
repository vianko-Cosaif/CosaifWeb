import { LocomotiveViewMode, WheelCount, WheelOverride, WheelPoint } from './types';
import { getAxleCount, normalizeWheels } from './wheelFactory';

export const VIEWBOX_WIDTH = 420;
export const VIEWBOX_HEIGHT = 760;
const SIDE_SVG_SCALE = 0.51;
const SIDE_SVG_TRANSLATE_X = -82;
const SIDE_SVG_TRANSLATE_X_HORIZONTAL = 90;
const SIDE_FRONT_AXLE_SOURCE_RANGE = [220, 500] as const;
const SIDE_REAR_AXLE_SOURCE_RANGE = [660, 920] as const;

export interface DiagramMetrics {
  width: number;
  height: number;
  bodyX: number;
  bodyY: number;
  bodyWidth: number;
  bodyHeight: number;
  centerX: number;
  leftWheelX: number;
  rightWheelX: number;
  sideWheelX: number;
  firstAxleY: number;
  lastAxleY: number;
}

export function getDiagramMetrics(viewMode: LocomotiveViewMode): DiagramMetrics {
  if (viewMode === 'top') {
    return {
      width: VIEWBOX_WIDTH,
      height: VIEWBOX_HEIGHT,
      bodyX: 145,
      bodyY: 90,
      bodyWidth: 130,
      bodyHeight: 560,
      centerX: 210,
      leftWheelX: 90,
      rightWheelX: 330,
      sideWheelX: 210,
      firstAxleY: 145,
      lastAxleY: 615,
    };
  }

  return {
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
    bodyX: 74,
    bodyY: 110,
    bodyWidth: 272,
    bodyHeight: 520,
    centerX: 210,
    leftWheelX: 118,
    rightWheelX: 302,
    sideWheelX: 210,
    firstAxleY: 168,
    lastAxleY: 590,
  };
}

export function getAxleYPositions(wheelCount: WheelCount, viewMode: LocomotiveViewMode): number[] {
  const axleCount = getAxleCount(wheelCount);
  const metrics = getDiagramMetrics(viewMode);

  if (axleCount === 1) return [(metrics.firstAxleY + metrics.lastAxleY) / 2];

  const gap = (metrics.lastAxleY - metrics.firstAxleY) / (axleCount - 1);

  return Array.from({ length: axleCount }, (_, index) => metrics.firstAxleY + index * gap);
}

export function getWheelPoints(
  wheelCount: WheelCount,
  viewMode: LocomotiveViewMode,
  selectedWheelId?: string,
  wheels: WheelOverride[] = [],
  orientation: 'vertical' | 'horizontal' = 'vertical',
): WheelPoint[] {
  const normalized = normalizeWheels(wheelCount, wheels);
  const metrics = getDiagramMetrics(viewMode);
  const yPositions = getAxleYPositions(wheelCount, viewMode);

  return normalized.map(wheel => {
    const y = yPositions[wheel.axleIndex - 1] ?? metrics.firstAxleY;
    const visualStatus = selectedWheelId === wheel.id ? 'selected' : wheel.status;

    if (viewMode === 'top') {
      return {
        ...wheel,
        x: wheel.side === 'left' ? metrics.rightWheelX : metrics.leftWheelX,
        y,
        radius: visualStatus === 'selected' ? 25 : 21,
        visible: true,
        visualStatus,
      };
    }

    const axleCount = Math.max(1, wheelCount / 2);
    const frontAxleCount = Math.ceil(axleCount / 2);
    const rearAxleCount = axleCount - frontAxleCount;
    const sideCanvasWidth = orientation === 'horizontal' ? VIEWBOX_HEIGHT : VIEWBOX_WIDTH;
    const sideTranslateX = orientation === 'horizontal'
      ? SIDE_SVG_TRANSLATE_X_HORIZONTAL
      : SIDE_SVG_TRANSLATE_X;
    const fromSideSvgX = (sourceX: number) => sideTranslateX + sourceX * SIDE_SVG_SCALE;
    const buildUniformRange = (start: number, end: number, count: number) => {
      if (count <= 0) return [];
      if (count === 1) return [(start + end) / 2];
      const gap = (end - start) / (count - 1);
      return Array.from({ length: count }, (_, index) => start + gap * index);
    };
    const sideWheelXs = [
      ...buildUniformRange(
        fromSideSvgX(SIDE_FRONT_AXLE_SOURCE_RANGE[0]),
        fromSideSvgX(SIDE_FRONT_AXLE_SOURCE_RANGE[1]),
        frontAxleCount,
      ),
      ...buildUniformRange(
        fromSideSvgX(SIDE_REAR_AXLE_SOURCE_RANGE[0]),
        fromSideSvgX(SIDE_REAR_AXLE_SOURCE_RANGE[1]),
        rearAxleCount,
      ),
    ].map((x) => (viewMode === 'right' ? sideCanvasWidth - x : x));

    return {
      ...wheel,
      x: sideWheelXs[wheel.axleIndex - 1] ?? metrics.centerX,
      y: 212,
      radius: visualStatus === 'selected' ? 21 : 17,
      visible: viewMode === 'left' ? wheel.side === 'left' : wheel.side === 'right',
      visualStatus,
    };
  });
}

export function getBogieRanges(wheelCount: WheelCount, viewMode: LocomotiveViewMode) {
  const yPositions = getAxleYPositions(wheelCount, viewMode);
  const metrics = getDiagramMetrics(viewMode);
  const splitIndex = Math.ceil(yPositions.length / 2);
  const frontYs = yPositions.slice(0, splitIndex);
  const rearYs = yPositions.slice(splitIndex);

  const pad = 42;

  return {
    front: {
      x: viewMode === 'top' ? metrics.bodyX - 18 : metrics.bodyX + 166,
      y: Math.min(...frontYs) - pad,
      width: viewMode === 'top' ? metrics.bodyWidth + 36 : 80,
      height: Math.max(...frontYs) - Math.min(...frontYs) + pad * 2,
    },
    rear: rearYs.length > 0
      ? {
          x: viewMode === 'top' ? metrics.bodyX - 18 : metrics.bodyX + 166,
          y: Math.min(...rearYs) - pad,
          width: viewMode === 'top' ? metrics.bodyWidth + 36 : 80,
          height: Math.max(...rearYs) - Math.min(...rearYs) + pad * 2,
        }
      : null,
  };
}
