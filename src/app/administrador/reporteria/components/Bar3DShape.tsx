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
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  if ((width ?? 0) <= 0 || (height ?? 0) <= 0) return null;

  const base = normalizeHex(color ?? "") ?? normalizeHex(fill ?? "") ?? DEFAULT_COLOR;
  const top = shadeColor(base, 0.18);
  const side = shadeColor(base, -0.18);
  const dx = depth;
  const dy = Math.max(2, Math.round(depth * 0.55));

  const front = `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
  const topPath = `M ${x} ${y} L ${x + dx} ${y - dy} L ${x + width + dx} ${y - dy} L ${x + width} ${y} Z`;
  const sidePath = `M ${x + width} ${y} L ${x + width + dx} ${y - dy} L ${x + width + dx} ${y + height - dy} L ${x + width} ${y + height} Z`;

  return (
    <g>
      <path d={topPath} fill={top} />
      <path d={sidePath} fill={side} />
      <path d={front} fill={base} />
    </g>
  );
}
