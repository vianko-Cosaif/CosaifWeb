import { type PatioTrack, type PatioServiceActivity, type ChangeKind, type PatioRemovedGhost, type MovementType } from "../types";
import { patioLayout, cssColor, polarPoint, toRad, trackEndPoint, roundRect, clampNumber } from "./geometry";

export function drawPatioCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  options: {
    tracks: PatioTrack[];
    serviceActivity: {
      torno: PatioServiceActivity;
      lavado: PatioServiceActivity;
    };
    selectedTrackId: string;
    changedKeys: Map<string, ChangeKind>;
    removedGhosts: PatioRemovedGhost[];
    time: number;
    reducedMotion: boolean;
  }
) {
  const { width, height } = canvas;
  const layout = patioLayout(width, height);
  const colors = {
    text: cssColor("--app-text", "#0f172a"),
    muted: cssColor("--app-text-muted", "#64748b"),
    border: cssColor("--app-border", "#cbd5e1"),
    surface: cssColor("--app-surface", "#ffffff"),
    surfaceMuted: cssColor("--app-surface-muted", "#f1f5f9"),
    surfaceSubtle: cssColor("--app-surface-subtle", "#f8fafc"),
    rail: "#193b78",
    railSoft: "#94a3b8",
    operating: "#10b981",
    moving: "#2563eb",
    stopped: "#e11d48",
    waiting: "#64748b",
    blocked: "#ef4444",
    bridge: "#4968b0",
    water: "rgba(37,99,235,.08)",
  };

  ctx.clearRect(0, 0, width, height);
  drawCanvasBackground(ctx, width, height);
  drawRoundhouse(ctx, layout, colors);
  drawTracks(ctx, layout, options.tracks, options.selectedTrackId, colors, options.time, options.reducedMotion);
  drawTurntable(ctx, layout, options.tracks, options.selectedTrackId, colors);
  drawBothRouteConnections(ctx, layout, options.tracks, colors, options.time, options.reducedMotion);
  drawMovingTrackArrows(ctx, layout, options.tracks, colors, options.time, options.reducedMotion);
  drawServices(ctx, layout, colors, options.serviceActivity, options.time, options.reducedMotion);
  drawLocomotives(ctx, layout, options.tracks, colors, options.time, options.changedKeys, options.reducedMotion, options.removedGhosts);
}

export function drawCanvasBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.65);
  gradient.addColorStop(0, "rgba(37,99,235,.08)");
  gradient.addColorStop(0.52, "rgba(16,185,129,.04)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,.10)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRoundhouse(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof patioLayout>, colors: Record<string, string>) {
  const { center, outerRadius, innerRadius } = layout;
  ctx.save();
  const shellGradient = ctx.createRadialGradient(center.x, center.y, innerRadius, center.x, center.y, outerRadius);
  shellGradient.addColorStop(0, colors.surfaceSubtle);
  shellGradient.addColorStop(1, colors.surfaceMuted);

  ctx.beginPath();
  ctx.arc(center.x, center.y, outerRadius, Math.PI, Math.PI * 2);
  ctx.lineTo(center.x + innerRadius, center.y);
  ctx.arc(center.x, center.y, innerRadius, Math.PI * 2, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = shellGradient;
  ctx.shadowColor = "rgba(15,23,42,.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.4;
  for (let index = 0; index <= 10; index += 1) {
    const angle = Math.PI + (index * Math.PI) / 10;
    const inner = polarPoint(layout, innerRadius, angle);
    const outer = polarPoint(layout, outerRadius, angle);
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = "900 13px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NAVE DE", center.x - outerRadius * 1.01, center.y - outerRadius * 0.91);
  ctx.fillText("MANTENIMIENTO", center.x - outerRadius * 1.01, center.y - outerRadius * 0.84);
  ctx.restore();
}

export function drawRailSegment(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  colors: Record<string, string>,
  options: { tieSpacing?: number; gap?: number; alpha?: number } = {}
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const gap = options.gap ?? 5;

  ctx.save();
  ctx.globalAlpha = options.alpha ?? 0.72;
  ctx.strokeStyle = colors.railSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(start.x + px * gap, start.y + py * gap);
  ctx.lineTo(end.x + px * gap, end.y + py * gap);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(start.x - px * gap, start.y - py * gap);
  ctx.lineTo(end.x - px * gap, end.y - py * gap);
  ctx.stroke();

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 3;
  for (let distance = 10; distance < length; distance += options.tieSpacing ?? 16) {
    const x = start.x + ux * distance;
    const y = start.y + uy * distance;
    ctx.beginPath();
    ctx.moveTo(x - px * 9, y - py * 9);
    ctx.lineTo(x + px * 9, y + py * 9);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTracks(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  selectedTrackId: string,
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  tracks.forEach((track) => {
    const angle = toRad(track.angle);
    const start = polarPoint(layout, layout.turntableRadius, angle);
    const end = trackEndPoint(layout, track.angle);
    const occupied = Boolean(track.locomotive);
    const selected = track.id === selectedTrackId && occupied;
    const pulse = reducedMotion ? 0 : (Math.sin(time / 420) + 1) / 2;
    const assignedColor = track.locomotive ? patioMovementColor(track.locomotive.type, colors) : colors.operating;
    const prominentAssignment = track.locomotive?.status === "moving" || track.locomotive?.status === "stopped";
    ctx.save();
    ctx.lineCap = "round";
    drawRailSegment(ctx, start, end, colors, { tieSpacing: 16, alpha: selected ? 0.82 : occupied ? 0.58 : 0.28 });

    if (prominentAssignment) {
      ctx.strokeStyle = assignedColor;
      ctx.lineWidth = selected ? 7 : 5.4;
      ctx.globalAlpha = selected ? 0.36 + pulse * 0.18 : 0.28 + pulse * 0.12;
      ctx.shadowColor = assignedColor;
      ctx.shadowBlur = selected ? 18 + pulse * 8 : 12 + pulse * 6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = selected ? 0.95 : 0.82;
      ctx.lineWidth = selected ? 3.2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (occupied) {
      ctx.strokeStyle = assignedColor;
      ctx.lineWidth = selected ? 3.5 : 2.6;
      ctx.globalAlpha = selected ? 0.34 + pulse * 0.18 : 0.22;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    if (track.mode !== "idle" || selected) {
      ctx.strokeStyle = track.mode === "blocked" ? colors.stopped : selected ? colors.moving : assignedColor;
      ctx.lineWidth = selected ? 4.2 : 3;
      ctx.globalAlpha = selected ? 0.5 + pulse * 0.22 : 0.38;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    if (track.mode === "entry") {
      const travel = reducedMotion ? 0.62 : (time / 1400) % 1;
      const marker = {
        x: start.x + (end.x - start.x) * travel,
        y: start.y + (end.y - start.y) * travel,
      };
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = colors.operating;
      ctx.shadowColor = colors.operating;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 5 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (track.mode === "blocked") {
      ctx.strokeStyle = colors.stopped;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(end.x - 13, end.y - 13);
      ctx.lineTo(end.x + 13, end.y + 13);
      ctx.moveTo(end.x + 13, end.y - 13);
      ctx.lineTo(end.x - 13, end.y + 13);
      ctx.stroke();
    }

    const labelDistance = layout.innerRadius + (layout.outerRadius - layout.innerRadius) * 0.58;
    const label = polarPoint(layout, labelDistance, angle);
    drawTrackLabel(ctx, track, label.x, label.y, colors, time, reducedMotion);
    ctx.restore();
  });
}

export function drawTrackLabel(
  ctx: CanvasRenderingContext2D,
  track: PatioTrack,
  x: number,
  y: number,
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  const occupied = Boolean(track.locomotive);
  const status = track.locomotive?.status ?? "waiting";
  const pulse = reducedMotion ? 0 : (Math.sin(time / 620) + 1) / 2;
  const statusColor =
    status === "moving" ? colors.moving : status === "stopped" ? colors.stopped : status === "operating" ? colors.operating : colors.waiting;
  const serviceColor = track.locomotive ? patioMovementColor(track.locomotive.type, colors) : statusColor;
  const badgeColor = status === "waiting" ? serviceColor : statusColor;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!occupied) {
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = colors.muted;
    ctx.font = "800 10px Inter, Arial, sans-serif";
    ctx.fillText(track.label, x, y);
    ctx.restore();
    return;
  }

  const labelText = track.label;
  const prominentAssignment = status === "moving" || status === "stopped";
  ctx.font = prominentAssignment ? "950 18px Inter, Arial, sans-serif" : "950 14px Inter, Arial, sans-serif";
  const textWidth = Math.max(prominentAssignment ? 32 : 22, ctx.measureText(labelText).width + (prominentAssignment ? 20 : 14));
  const badgeHeight = prominentAssignment ? 30 : 22;
  const badgeRadius = prominentAssignment ? 11 : 8;

  ctx.shadowColor = badgeColor;
  ctx.shadowBlur = prominentAssignment ? 14 + pulse * 9 : 5;
  ctx.fillStyle =
    status === "moving"
      ? "rgba(37,99,235,.16)"
      : status === "stopped"
        ? "rgba(225,29,72,.16)"
        : status === "operating"
          ? "rgba(16,185,129,.14)"
          : track.locomotive?.type === "Torno"
            ? "rgba(225,29,72,.13)"
            : track.locomotive?.type === "Lavado"
              ? "rgba(14,165,233,.13)"
              : "rgba(16,185,129,.13)";
  roundRect(ctx, x - textWidth / 2, y - badgeHeight / 2, textWidth, badgeHeight, badgeRadius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = badgeColor;
  ctx.globalAlpha = prominentAssignment ? 1 : 0.74;
  ctx.lineWidth = prominentAssignment ? 2.8 : 1.5;
  roundRect(ctx, x - textWidth / 2, y - badgeHeight / 2, textWidth, badgeHeight, badgeRadius);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.text;
  ctx.fillText(labelText, x, y + 1);

  if (prominentAssignment) {
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(x + textWidth / 2 - 5, y - badgeHeight / 2 + 5, 5 + pulse * 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (track.locomotive?.activeIncidentCount) {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(x + textWidth / 2 - 8, y - badgeHeight / 2 + 3);
    ctx.lineTo(x + textWidth / 2 - 2, y - badgeHeight / 2 + 13);
    ctx.lineTo(x + textWidth / 2 - 14, y - badgeHeight / 2 + 13);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawMovingTrackArrows(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  tracks.forEach((track) => {
    if (track.locomotive?.status !== "moving") return;

    const vector = movementArrowVector(layout, tracks, track);
    const { start, end, angle } = vector;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 40) return;

    const arrowColor = patioMovementColor(track.locomotive.type, colors);
    const arrowCount = layout.mobile ? 2 : 3;
    const motion = reducedMotion ? 0.25 : (time / 3400) % 1;
    const size = clampNumber(layout.outerRadius * 0.045, layout.mobile ? 11 : 13, layout.mobile ? 17 : 21);
    const gap = 0.16;
    const first = 0.24;
    const travelRange = 0.46;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let index = 0; index < arrowCount; index += 1) {
      const raw = first + index * gap + motion * 0.18;
      const progress = first + ((raw - first) % travelRange);
      const x = start.x + dx * progress;
      const y = start.y + dy * progress;
      const wave = reducedMotion ? 0.55 : 0.42 + ((Math.sin(time / 900 + index * 0.85) + 1) / 2) * 0.2;

      drawPatioArrowHead(ctx, x, y, angle, size, arrowColor, wave);
    }

    ctx.restore();
  });
}

export function quadraticPoint(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number
) {
  const inv = 1 - t;
  return {
    x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
    y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
  };
}

export function quadraticAngle(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number
) {
  const inv = 1 - t;
  const dx = 2 * inv * (control.x - start.x) + 2 * t * (end.x - control.x);
  const dy = 2 * inv * (control.y - start.y) + 2 * t * (end.y - control.y);
  return Math.atan2(dy, dx);
}

export function drawBothRouteConnections(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  const drawn = new Set<string>();
  tracks.forEach((track) => {
    const locomotives = track.locomotives?.length ? track.locomotives : track.locomotive ? [track.locomotive] : [];
    locomotives.forEach((locomotive) => {
      if (locomotive.placement !== "both" || !locomotive.originTrackId || !locomotive.destinationTrackId) return;
      if (locomotive.originTrackId === locomotive.destinationTrackId) return;
      if (drawn.has(locomotive.key)) return;
      drawn.add(locomotive.key);

      const originTrack = tracks.find((item) => item.id === locomotive.originTrackId);
      const destinationTrack = tracks.find((item) => item.id === locomotive.destinationTrackId);
      if (!originTrack || !destinationTrack) return;

      const routeColor = patioMovementColor(locomotive.type, colors);
      const active = locomotive.status === "moving";
      const stopped = locomotive.status === "stopped";
      if (!active) {
        const markColor = stopped ? colors.stopped : routeColor;
        drawAssignedRouteTrackMark(ctx, layout, originTrack, markColor, "DE", stopped ? 0.5 : 0.32);
        drawAssignedRouteTrackMark(ctx, layout, destinationTrack, markColor, "PARA", stopped ? 0.5 : 0.32);
        return;
      }

      const start = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * 0.42, toRad(originTrack.angle));
      const end = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * 0.72, toRad(destinationTrack.angle));
      const control = {
        x: layout.center.x + Math.cos((toRad(originTrack.angle) + toRad(destinationTrack.angle)) / 2) * layout.turntableRadius * 0.72,
        y: layout.center.y + Math.sin((toRad(originTrack.angle) + toRad(destinationTrack.angle)) / 2) * layout.turntableRadius * 0.72,
      };
      const pulse = reducedMotion ? 0.4 : 0.28 + ((Math.sin(time / 520) + 1) / 2) * 0.22;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([14, 8]);
      ctx.lineDashOffset = reducedMotion ? 0 : -time / 70;
      ctx.strokeStyle = routeColor;
      ctx.lineWidth = 4.2;
      ctx.globalAlpha = 0.46 + pulse * 0.22;
      ctx.shadowColor = routeColor;
      ctx.shadowBlur = 14 + pulse * 10;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.95;
      const markerT = reducedMotion ? 0.62 : 0.18 + ((time / 3600) % 0.64);
      const markerPoint = quadraticPoint(start, control, end, markerT);
      const markerAngle = quadraticAngle(start, control, end, markerT);
      drawPatioArrowHead(ctx, markerPoint.x, markerPoint.y, markerAngle, clampNumber(layout.outerRadius * 0.034, 10, 17), routeColor, 0.82);

      [start, end].forEach((point) => {
        ctx.fillStyle = routeColor;
        ctx.shadowColor = routeColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(point.x, point.y, active ? 4.8 : 3.8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
  });
}

export function drawAssignedRouteTrackMark(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  track: PatioTrack,
  color: string,
  label: "DE" | "PARA",
  alpha: number
) {
  const angle = toRad(track.angle);
  const start = polarPoint(layout, layout.turntableRadius + 18, angle);
  const end = trackEndPoint(layout, track.angle);
  const labelPoint = polarPoint(layout, layout.innerRadius + 28, angle);

  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = Math.min(0.92, alpha + 0.22);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(labelPoint.x - 18, labelPoint.y - 9, 36, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 8px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelPoint.x, labelPoint.y);
  ctx.restore();
}

export function movementArrowVector(layout: ReturnType<typeof patioLayout>, tracks: PatioTrack[], track: PatioTrack) {
  const originTrack = tracks.find((item) => item.id === track.originTrackId) ?? track;
  const destinationTrack = tracks.find((item) => item.id === track.destinationTrackId);
  const originAngle = toRad(originTrack.angle);
  const originPoint = polarPoint(layout, layout.turntableRadius + 26, originAngle);

  if (destinationTrack && destinationTrack.id !== originTrack.id) {
    const destinationPoint = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * 0.62, toRad(destinationTrack.angle));
    const angle = Math.atan2(destinationPoint.y - originPoint.y, destinationPoint.x - originPoint.x);
    return { start: originPoint, end: destinationPoint, angle };
  }

  return {
    start: originPoint,
    end: trackEndPoint(layout, originTrack.angle),
    angle: originAngle,
  };
}

export function patioMovementColor(type: MovementType, colors: Record<string, string>) {
  if (type === "Torno") return colors.stopped;
  if (type === "Lavado") return "#0ea5e9";
  return colors.operating;
}

export function drawPatioArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(size * 1.08, 0);
  ctx.lineTo(-size * 0.72, -size * 0.78);
  ctx.lineTo(-size * 0.34, 0);
  ctx.lineTo(-size * 0.72, size * 0.78);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(15,23,42,.42)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.globalAlpha = Math.min(1, alpha + 0.08);
  ctx.beginPath();
  ctx.moveTo(size * 0.58, 0);
  ctx.lineTo(-size * 0.36, -size * 0.38);
  ctx.lineTo(-size * 0.16, 0);
  ctx.lineTo(-size * 0.36, size * 0.38);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,.34)";
  ctx.fill();
  ctx.restore();
}

export function drawTurntable(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof patioLayout>, tracks: PatioTrack[], selectedTrackId: string, colors: Record<string, string>) {
  const selected =
    tracks.find((track) => track.id === selectedTrackId && track.locomotive) ??
    tracks.find((track) => track.mode === "entry") ??
    tracks.find((track) => track.locomotive) ??
    tracks.find((track) => track.id === selectedTrackId) ??
    tracks[0];
  const angle = toRad(selected.angle);
  const length = layout.turntableRadius * 1.85;
  const dx = Math.cos(angle) * length * 0.5;
  const dy = Math.sin(angle) * length * 0.5;

  ctx.save();
  const gradient = ctx.createRadialGradient(layout.center.x, layout.center.y - layout.turntableRadius * 0.4, 8, layout.center.x, layout.center.y, layout.turntableRadius);
  gradient.addColorStop(0, colors.surfaceSubtle);
  gradient.addColorStop(1, colors.surfaceMuted);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(layout.center.x, layout.center.y, layout.turntableRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = colors.railSoft;
  ctx.beginPath();
  ctx.arc(layout.center.x, layout.center.y, layout.turntableRadius - 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(layout.center.x - dx, layout.center.y - dy);
  ctx.lineTo(layout.center.x + dx, layout.center.y + dy);
  ctx.stroke();

  ctx.fillStyle = colors.surface;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(layout.center.x, layout.center.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = "900 14px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MESA", layout.center.x, layout.center.y - 22);
  ctx.fillText("GIRATORIO", layout.center.x, layout.center.y + 1);
  ctx.restore();
}

export function drawServices(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  colors: Record<string, string>,
  activity: { torno: PatioServiceActivity; lavado: PatioServiceActivity },
  time: number,
  reducedMotion: boolean
) {
  const lavado = {
    x: clampNumber(layout.center.x - layout.outerRadius - (layout.mobile ? 24 : 52), layout.mobile ? 62 : 76, layout.width - 58),
    y: layout.center.y - layout.outerRadius * (layout.mobile ? 0.26 : 0.34),
  };
  const torno = {
    x: clampNumber(layout.center.x + layout.outerRadius + (layout.mobile ? 36 : 64), 58, layout.width - 58),
    y: layout.center.y - layout.outerRadius * 0.35,
  };
  drawServiceBadge(ctx, lavado.x, lavado.y - 18, "drop", "LAVADO", colors, null, time, reducedMotion, {
    muted: true,
    caption: "MOV. EN VIA",
  });
  drawServiceBadge(ctx, torno.x, torno.y - 18, "gear", "TORNO", colors, activity.torno, time, reducedMotion);
}

export function drawServiceBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: "drop" | "gear",
  label: string,
  colors: Record<string, string>,
  activity: PatioServiceActivity,
  time: number,
  reducedMotion: boolean,
  options: { muted?: boolean; caption?: string } = {}
) {
  const active = activity?.status === "moving";
  const pulse = reducedMotion ? 0.35 : 0.25 + ((Math.sin(time / 360) + 1) / 2) * 0.35;
  const tone = icon === "gear" ? colors.stopped : "#0ea5e9";
  ctx.save();
  ctx.globalAlpha = options.muted ? 0.74 : 1;
  ctx.shadowColor = active && !options.muted ? tone : "rgba(0,0,0,0)";
  ctx.shadowBlur = active && !options.muted ? 12 + pulse * 16 : 0;
  ctx.fillStyle = icon === "gear" ? "rgba(225,29,72,.12)" : "rgba(59,130,246,.08)";
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = active ? tone : colors.text;
  ctx.lineWidth = 2.2;
  if (icon === "drop") {
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.bezierCurveTo(x - 12, y + 2, x - 10, y + 13, x, y + 13);
    ctx.bezierCurveTo(x + 10, y + 13, x + 12, y + 2, x, y - 12);
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let index = 0; index < 12; index += 1) {
      const angle = (index * Math.PI) / 6;
      const radius = index % 2 === 0 ? 14 : 9;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = colors.text;
  ctx.font = "900 13px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 48);
  if (!activity && options.caption) {
    ctx.fillStyle = colors.muted;
    ctx.font = "900 7px Inter, Arial, sans-serif";
    ctx.fillText(options.caption, x, y + 61);
  }
  if (activity) {
    const chipY = y + 66;
    ctx.fillStyle = active ? tone : colors.surface;
    ctx.strokeStyle = active ? tone : colors.border;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x - 34, chipY - 13, 68, 25, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#ffffff" : colors.text;
    ctx.font = "900 11px Inter, Arial, sans-serif";
    ctx.fillText(activity.number, x, chipY - 2);
    ctx.font = "800 7px Inter, Arial, sans-serif";
    ctx.fillText(active ? "EN PROCESO" : "EN COLA", x, chipY + 8);
  }
  ctx.restore();
}

export function drawLocomotives(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  colors: Record<string, string>,
  time: number,
  changedKeys: Map<string, ChangeKind>,
  reducedMotion: boolean,
  removedGhosts: PatioRemovedGhost[]
) {
  removedGhosts.forEach((ghost) => {
    const age = Math.max(0, time - ghost.removedAt);
    if (age > 1800) return;
    const point = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * 0.72, toRad(ghost.angle));
    const progress = reducedMotion ? 1 : age / 1800;
    const alpha = (1 - progress) * 0.72;
    const scale = 1 - progress * 0.16;
    drawLocomotiveChip(ctx, point.x, point.y, ghost, colors, time, new Map(), reducedMotion, { alpha, scale });
  });

  tracks.forEach((track) => {
    const locomotives = track.locomotives?.length ? track.locomotives : track.locomotive ? [track.locomotive] : [];
    const visibleLocomotives = locomotives.slice(0, 3);
    [...visibleLocomotives]
      .sort((left, right) => {
        const priority = (locomotive: NonNullable<PatioTrack["locomotive"]>) =>
          locomotive.status === "moving" || locomotive.status === "stopped" ? 2 : locomotive.status === "operating" ? 1 : 0;
        const priorityDelta = priority(left) - priority(right);
        if (priorityDelta !== 0) return priorityDelta;
        return visibleLocomotives.findIndex((item) => item.key === right.key) - visibleLocomotives.findIndex((item) => item.key === left.key);
      })
      .forEach((locomotive) => {
      const index = visibleLocomotives.findIndex((item) => item.key === locomotive.key);
      const placement = locomotive.placement ?? track.placement;
      const baseRadiusFactor =
        placement === "destination"
          ? 0.86
          : placement === "origin"
            ? 0.58
            : 0.72;
      const radiusOffset = (index - (visibleLocomotives.length - 1) / 2) * 0.085;
      const radiusFactor = clampNumber(baseRadiusFactor + radiusOffset, 0.48, 0.92);
      const point = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * radiusFactor, toRad(track.angle));
      drawLocomotiveChip(ctx, point.x, point.y, { ...track, locomotive, placement }, colors, time, changedKeys, reducedMotion, {
        scale: index === 0 ? 1 : 0.92,
      });
      });
  });
}

export function drawLocomotiveChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  track: PatioTrack,
  colors: Record<string, string>,
  time: number,
  changedKeys: Map<string, ChangeKind>,
  reducedMotion: boolean,
  effect?: { alpha?: number; scale?: number }
) {
  const locomotive = track.locomotive;
  if (!locomotive) return;
  const statusColor =
    locomotive.status === "stopped"
      ? colors.stopped
      : locomotive.status === "moving"
        ? colors.moving
        : locomotive.status === "waiting"
          ? colors.waiting
          : colors.operating;
  const glow = reducedMotion ? 0.22 : 0.16 + ((Math.sin(time / 480) + 1) / 2) * 0.18;
  const radius = 28;
  const changeKind = changedKeys.get(locomotive.key);
  const changed = Boolean(changeKind);
  const zoomPulse = changed && !reducedMotion ? (Math.sin(time / 190) + 1) / 2 : 0;
  const isBothPlacement = track.placement === "both";
  const statusScale =
    (locomotive.status === "moving" || locomotive.status === "stopped")
      ? 1.3 + (reducedMotion ? 0 : glow * 0.08)
      : locomotive.status === "waiting"
        ? 1
      : changeKind === "updated"
        ? 1.08 + zoomPulse * 0.06
        : changeKind === "moved"
        ? 1.04 + zoomPulse * 0.04
        : 1;
  const scale = effect?.alpha !== undefined ? effect.scale ?? statusScale : statusScale * (effect?.scale ?? 1);
  const chipWidth = isBothPlacement ? 86 : 76;
  const chipHalf = chipWidth / 2;
  const placementBadgeWidth = isBothPlacement ? 48 : 34;

  ctx.save();
  ctx.globalAlpha = effect?.alpha ?? 1;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  ctx.shadowColor = statusColor;
  ctx.shadowBlur = changed ? 22 + zoomPulse * 14 : glow * 32;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = changed ? 4.5 : 3;
  ctx.beginPath();
  ctx.roundRect(x - chipHalf, y - 18, chipWidth, 36, 8);
  ctx.fill();
  ctx.stroke();

  const placementLabel = track.placement === "destination" ? "PARA" : isBothPlacement ? "DE/PARA" : "DE";
  const placementIcon = track.placement === "destination" ? "→" : track.placement === "both" ? "↔" : "•";
  const placementColor =
    track.placement === "destination"
      ? colors.moving
      : track.placement === "both"
        ? "#7c3aed"
        : colors.operating;

  ctx.shadowBlur = 0;
  ctx.fillStyle = placementColor;
  ctx.beginPath();
  ctx.roundRect(x - chipHalf, y - 31, placementBadgeWidth, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = isBothPlacement ? "900 6.5px Inter, Arial, sans-serif" : "900 7px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(placementLabel, x - chipHalf + placementBadgeWidth / 2, y - 24);

  ctx.fillStyle = placementColor;
  ctx.font = "900 18px Inter, Arial, sans-serif";
  ctx.fillText(placementIcon, x + chipHalf - 4, y - 26);

  ctx.shadowBlur = 0;
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(x - chipHalf + 15, y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "900 14px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(locomotive.number, x + (isBothPlacement ? 10 : 7), y - 2);

  ctx.fillStyle = colors.muted;
  ctx.font = "800 8px Inter, Arial, sans-serif";
  ctx.fillText(locomotive.type.toUpperCase(), x + (isBothPlacement ? 10 : 7), y + 11);

  ctx.fillStyle = statusColor;
  ctx.font = "900 9px Inter, Arial, sans-serif";
  ctx.fillText(track.label, x, y + radius + 21);

  if (locomotive.activeIncidentCount > 0) {
    const attentionPulse = reducedMotion ? 0.35 : 0.25 + ((Math.sin(time / 360) + 1) / 2) * 0.35;
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 10 + attentionPulse * 10;
    ctx.fillStyle = "#f59e0b";
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 31, y - 24);
    ctx.lineTo(x + 42, y - 5);
    ctx.lineTo(x + 20, y - 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#111827";
    ctx.font = "900 11px Inter, Arial, sans-serif";
    ctx.fillText("!", x + 31, y - 11);
  }
  ctx.restore();
}
