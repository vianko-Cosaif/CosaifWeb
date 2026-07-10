const DEFAULT_TORREON_LOCALIDAD_IDS = "2";

function parseIds(value?: string) {
  return String(value || DEFAULT_TORREON_LOCALIDAD_IDS)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

export function isTorreonLocalidadId(localidadId?: string | number | null) {
  const target = Number(localidadId);
  if (!Number.isFinite(target) || target <= 0) return false;

  const configured =
    process.env.NEXT_PUBLIC_TORREON_LOCALIDAD_IDS ||
    process.env.NEXT_PUBLIC_TORREON_LOCALIDAD_ID ||
    DEFAULT_TORREON_LOCALIDAD_IDS;

  return parseIds(configured).includes(target);
}

export function getTorreonLocalidadIds() {
  const configured =
    process.env.NEXT_PUBLIC_TORREON_LOCALIDAD_IDS ||
    process.env.NEXT_PUBLIC_TORREON_LOCALIDAD_ID ||
    DEFAULT_TORREON_LOCALIDAD_IDS;

  return parseIds(configured);
}

export function getPrimaryTorreonLocalidadId() {
  return getTorreonLocalidadIds()[0] ?? Number(DEFAULT_TORREON_LOCALIDAD_IDS);
}

export function normalizeRoleName(role?: string | null) {
  return String(role || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isClienteAreaRole(role?: string | null) {
  return ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "ARRASTRE_TORREON"].includes(normalizeRoleName(role));
}

export function canViewTorreonArrastreRole(role?: string | null) {
  return [
    "ADMINISTRADOR",
    "COORDINADOR",
    "SUPERVISOR",
    "CLIENTE_ADMIN",
    "CLIENTE_COOR",
    "ARRASTRE_TORREON",
  ].includes(normalizeRoleName(role));
}

export function canResolveTorreonIncidentRole(role?: string | null) {
  return [
    "ADMINISTRADOR",
    "COORDINADOR",
    "SUPERVISOR",
    "CLIENTE",
    "CLIENTE_ADMIN",
    "CLIENTE_COOR",
    "ARRASTRE_TORREON",
  ].includes(normalizeRoleName(role));
}
