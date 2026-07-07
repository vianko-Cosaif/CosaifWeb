const TORREON_IMAGE_PREFIX = "/api/torreon/imagenes";

function encodePathSegments(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function toTorreonImageProxyUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  if (/^(data|blob):/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith(`${TORREON_IMAGE_PREFIX}/`)) return raw;

  const normalized = raw
    .replace(/^\/+/, "")
    .replace(/^uploads\/incidentes\/+/i, "")
    .replace(/^incidentes\/+/i, "");

  return `${TORREON_IMAGE_PREFIX}/${encodePathSegments(normalized)}`;
}
