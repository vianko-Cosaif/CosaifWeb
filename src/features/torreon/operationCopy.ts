export function operationStatusLabel(status?: string | null) {
  const value = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const labels: Record<string, string> = {
    SOLICITADO: "Solicitado",
    PENDIENTE: "Pendiente",
    EN_PROCESO: "En proceso",
    PROCESO: "En proceso",
    DETENIDO: "Detenido",
    BLOQUEADO: "Bloqueado",
    CONCLUIDO: "Concluido",
    FINALIZADO: "Finalizado",
    CANCELADO: "Cancelado",
    ABIERTO: "Abierto",
    RESUELTO: "Resuelto",
  };

  return labels[value] || value.replaceAll("_", " ").toLocaleLowerCase("es-MX").replace(/^./, (letter) => letter.toUpperCase()) || "Sin estado";
}

export function operationStatusHint(status?: string | null) {
  const value = String(status || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (value === "SOLICITADO" || value === "PENDIENTE") return "Aún no inicia";
  if (value === "EN_PROCESO" || value === "PROCESO") return "Atención operativa en curso";
  if (value === "DETENIDO" || value === "BLOQUEADO") return "Requiere atención";
  if (value === "CONCLUIDO" || value === "FINALIZADO") return "Operación terminada";
  if (value === "CANCELADO") return "Operación cancelada";
  return "Estado de la operación";
}
