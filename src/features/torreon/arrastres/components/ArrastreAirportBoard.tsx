"use client";
import type { Arrastre, DailyInfo, IncidenteArrastre } from "../types";
import { ArrastreTerminalTable } from "../../cliente/components/ArrastreTerminalTable";
type Props = {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
  onAuditSelect?: (arrastre: Arrastre) => void;
};

export default function ArrastreAirportBoard(props: Props) {
  return (
    <ArrastreTerminalTable
      {...props}
      title="Cola de arrastres"
      subtitle="Solicitudes activas del patio"
      pageSize={Math.max(1, props.rows.length)}
      hidePagination
    />
  );
}
