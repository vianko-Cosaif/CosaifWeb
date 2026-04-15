import React from "react";

const DEFAULT_COLOR = "#6366f1";

function normalizeHex(input: string) {
  let hex = input.trim();
  if (!hex.startsWith("#")) return null;
  hex = hex.slice(1);
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (hex.length === 6) return `#${hex}`;
  return null;
}

function shadeColor(hex: string, percent: number) {
  const normalized = normalizeHex(hex) ?? DEFAULT_COLOR;
  const raw = normalized.slice(1);
  const num = Number.parseInt(raw, 16);
  if (!Number.isFinite(num)) return normalized;
  const amt = Math.round(255 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}

export default function Bar3DShape({
  x,
  y,
  width,
  height,
  fill,
  color,
  depth = 8,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  color?: string;
  depth?: number;
}) {
  if (x == null || y == null || width == null || height == null) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;

  const x0 = x as number;
  const y0 = y as number;
  const w0 = width as number;
  const h0 = height as number;

  const base = normalizeHex(color ?? "") ?? normalizeHex(fill ?? "") ?? DEFAULT_COLOR;
  const top = shadeColor(base, 0.18);
  const side = shadeColor(base, -0.18);
  const dx = depth;
  const dy = Math.max(2, Math.round(depth * 0.55));

  const front = `M ${x0} ${y0} L ${x0 + w0} ${y0} L ${x0 + w0} ${y0 + h0} L ${x0} ${y0 + h0} Z`;
  const topPath = `M ${x0} ${y0} L ${x0 + dx} ${y0 - dy} L ${x0 + w0 + dx} ${y0 - dy} L ${x0 + w0} ${y0} Z`;
  const sidePath = `M ${x0 + w0} ${y0} L ${x0 + w0 + dx} ${y0 - dy} L ${x0 + w0 + dx} ${y0 + h0 - dy} L ${x0 + w0} ${y0 + h0} Z`;

  return (
    <g>
      <path d={topPath} fill={top} />
      <path d={sidePath} fill={side} />
      <path d={front} fill={base} />
    </g>
  );
}
