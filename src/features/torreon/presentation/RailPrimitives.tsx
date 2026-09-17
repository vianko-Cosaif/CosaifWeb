import { TrainFront, type LucideIcon } from "lucide-react";
import type { VagonArrastre } from "../arrastres/types";
import s from "./rail.module.scss";

export function RailRoute({ vagon }: { vagon?: VagonArrastre | null }) {
  return (
    <div className={s.route}>
      <div className={s.routeNode}>
        <small>Origen</small>
        <strong>
          {vagon?.viaOrigenNombre ||
            (vagon?.viaOrigenId ? `Vía ${vagon.viaOrigenId}` : "Por definir")}
        </strong>
        {vagon?.seccionOrigenNombre || vagon?.seccionOrigenId ? (
          <span>Sección {vagon.seccionOrigenNombre || vagon.seccionOrigenId}</span>
        ) : null}
      </div>
      <span className={s.routeLine} aria-hidden="true" />
      <div className={s.routeNode}>
        <small>Destino</small>
        <strong>
          {vagon?.viaDestinoNombre || (vagon?.viaId ? `Vía ${vagon.viaId}` : "Por definir")}
        </strong>
        {vagon?.seccionDestinoNombre || vagon?.seccionId ? (
          <span>Sección {vagon.seccionDestinoNombre || vagon.seccionId}</span>
        ) : null}
      </div>
    </div>
  );
}
export function RailConsist({ vagones }: { vagones: VagonArrastre[] }) {
  return (
    <div
      className={s.trainTrack}
      role="group"
      aria-label={`Composición: ${vagones.length} vagones`}
    >
      <div className={s.consist}>
        <div className={s.engine} aria-hidden>
          <TrainFront size={26} />
        </div>
        {vagones.slice(0, 4).map((vagon) => (
          <div className={s.wagon} key={vagon.id} data-state={vagon.estado}>
            <span>{vagon.numeroVagon || `Vagón ${vagon.orden}`}</span>
          </div>
        ))}
        {vagones.length > 4 ? <span className={s.count}>+{vagones.length - 4}</span> : null}
      </div>
    </div>
  );
}
export function RailMetrics({
  items,
}: {
  items: { label: string; value: number; hint?: string; icon: LucideIcon }[];
}) {
  return (
    <div className={s.metrics}>
      {items.map(({ label, value, hint, icon: Icon }) => (
        <div className={s.metric} key={label}>
          <div className={s.metricTop}>
            <span>{label}</span>
            <Icon size={17} aria-hidden />
          </div>
          <strong className={s.metricValue}>{value}</strong>
          {hint ? <span className={s.metricHint}>{hint}</span> : null}
        </div>
      ))}
    </div>
  );
}
