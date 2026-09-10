export function toText(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "object") {
    if ("nombre" in val) return String(val.nombre);
    if ("numero" in val) return String(val.numero);
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}
