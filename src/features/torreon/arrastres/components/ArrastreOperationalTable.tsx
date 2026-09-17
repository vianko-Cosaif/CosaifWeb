"use client";
import type { Arrastre, DailyInfo, IncidenteArrastre, VagonArrastre } from "../types";
import { normalizeStatus } from "../utils";
import { ArrastreTerminalTable } from "../../cliente/components/ArrastreTerminalTable";
type Props = {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  compact?: boolean;
  mode?: "active" | "history";
  busyArrastreId?: number | null;
  canPrioritizeByIncident?: boolean;
  onPrioritizeArrastre?: (arrastre: Arrastre) => void;
  onStartVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onFinishVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  busyVagonKey?: string | null;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
  onAuditSelect?: (arrastre: Arrastre) => void;
};

export default function ArrastreOperationalTable({
  rows,
  dailyCounters,
  mode = "active",
  busyArrastreId,
  busyVagonKey,
  canPrioritizeByIncident,
  onPrioritizeArrastre,
  onStartVagon,
  onFinishVagon,
  onIncidentSelect,
  onAuditSelect,
}: Props) {
  const editableSolicitudIds = rows
    .filter(
      (row) =>
        ["SOLICITADO", "DETENIDO"].includes(normalizeStatus(row.estado)) &&
        !row.vagones?.some((v) => normalizeStatus(v.estado) === "EN_PROCESO"),
    )
    .map((row) => row.id);
  return (
    <ArrastreTerminalTable
      rows={rows}
      dailyCounters={dailyCounters}
      title={mode === "history" ? "Historial de arrastres" : "Solicitudes activas"}
      subtitle={
        mode === "history"
          ? "Recorridos y resultados de cada solicitud"
          : "Turnos y avance de la operación"
      }
      pageSize={Math.max(1, rows.length)}
      hidePagination
      busyAction={busyVagonKey ?? (busyArrastreId != null ? String(busyArrastreId) : null)}
      editableSolicitudIds={editableSolicitudIds}
      canPrioritizeByIncident={mode === "active" && canPrioritizeByIncident}
      onPrioritizeSolicitud={mode === "active" ? onPrioritizeArrastre : undefined}
      onStartVagon={mode === "active" ? onStartVagon : undefined}
      onFinishVagon={mode === "active" ? onFinishVagon : undefined}
      onIncidentSelect={onIncidentSelect}
      onAuditSelect={onAuditSelect}
    />
  );
}
