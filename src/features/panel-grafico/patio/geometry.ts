
export const toRad = (degrees: number) => (degrees * Math.PI) / 180;

export const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const polarPoint = (layout: ReturnType<typeof patioLayout>, radius: number, angle: number) => ({
  x: layout.center.x + Math.cos(angle) * radius,
  y: layout.center.y + Math.sin(angle) * radius,
});

export function resizeCanvas(canvas: HTMLCanvasElement, container: HTMLDivElement) {
  const rect = container.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(600, Math.floor(rect.width * ratio));
  const height = Math.max(360, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function patioLayout(width: number, height: number) {
  const mobile = width < 760;
  const wide = width / Math.max(1, height) > 1.55;
  const sideReserve = mobile ? 76 : clampNumber(width * 0.105, 96, 150);
  const topReserve = mobile ? 42 : clampNumber(height * 0.08, 34, 58);
  const bottomReserve = mobile ? 58 : clampNumber(height * 0.08, 42, 70);
  const availableWidth = Math.max(240, width - sideReserve * 2);
  const availableHeight = Math.max(180, height - topReserve - bottomReserve);
  const radiusByWidth = availableWidth / 2.08;
  const radiusByHeight = availableHeight / (wide ? 1.52 : 1.36);
  const outerRadius = clampNumber(Math.min(radiusByWidth, radiusByHeight), 120, Math.max(130, Math.min(width, height) * 0.82));
  const center = {
    x: mobile ? width * 0.50 : width * 0.49,
    y: clampNumber(topReserve + outerRadius, height * (mobile ? 0.55 : 0.60), height - bottomReserve - outerRadius * 0.24),
  };
  const innerRadius = outerRadius * 0.76;
  const turntableRadius = outerRadius * 0.27;
  return { center, outerRadius, innerRadius, turntableRadius, mobile, width, height };
}

export function trackEndPoint(layout: ReturnType<typeof patioLayout>, angle: number) {
  return polarPoint(layout, layout.innerRadius + 12, toRad(angle));
}

export function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clampNumber(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function cssColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, safeRadius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}
