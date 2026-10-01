import { AlertTriangle, Boxes, CheckCircle2, ClipboardList, Play, PauseCircle } from "lucide-react";
import { RailMetrics } from "../../presentation/RailPrimitives";
import type { ArrastreStats } from "../types";
export default function ArrastreStatusStrip({
  stats,
  operational = false,
}: {
  stats: ArrastreStats;
  operational?: boolean;
}) {
  return (
    <RailMetrics
      items={[
        { label: "En espera", value: stats.solicitados, icon: ClipboardList },
        { label: "En movimiento", value: stats.proceso, icon: Play },
        operational
          ? { label: "Pausados", value: stats.detenidos, icon: PauseCircle }
          : { label: "Finalizados", value: stats.concluidos, icon: CheckCircle2 },
        operational
          ? { label: "Vagones por mover", value: stats.vagonesPendientes, icon: Boxes }
          : { label: "Incidentes abiertos", value: stats.incidentesAbiertos, icon: AlertTriangle },
      ]}
    />
  );
}
