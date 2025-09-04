export function toText(val: any): string {
  if (val == null) return "—";
  if (typeof val === "object") {
    if ("nombre" in val) return String((val as any).nombre);
    if ("numero" in val) return String((val as any).numero);
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}
