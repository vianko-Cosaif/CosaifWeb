import { ListOrdered, TrainFront, Info } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Arrastre } from "../types";
import { buildArrastreFolio, normalizeStatus } from "../utils";
import {
  getCurrentVagon,
  getStats,
  orderedVagones,
} from "../../cliente/components/ArrastreTerminalTable/helpers";
import { RailConsist, RailRoute } from "../../presentation/RailPrimitives";
import s from "../../presentation/rail.module.scss";

export default function ArrastreFocus({ rows }: { rows: Arrastre[] }) {
  const current =
    rows.find((row) => normalizeStatus(row.estado) === "EN_PROCESO") ??
    rows.find((row) => normalizeStatus(row.estado) === "SOLICITADO") ??
    rows[0];
  const next = rows.filter((row) => row.id !== current?.id).slice(0, 3);
  const stats = current ? getStats(current) : null;
  return (
    <section aria-label="Lectura rápida de la cola visible" className={s.focusGrid}>
      <article className={s.feature}>
        <header className={s.featureTop}>
          <h2 className={s.featureTitle}>
            <TrainFront size={18} aria-hidden />{" "}
            {normalizeStatus(current?.estado) === "EN_PROCESO"
              ? "Maniobra en curso"
              : "En el patio"}
          </h2>
          {current ? <StatusBadge status={current.estado} size="sm" /> : null}
        </header>
        {current && stats ? (
          <div className={s.featureBody}>
            <div className={s.reference}>
              <h3>{buildArrastreFolio(current)}</h3>
              <span>
                Turno {current.ordenSolicitud ?? "—"} · {stats.total} vagones
              </span>
            </div>
            <RailConsist vagones={orderedVagones(current)} />
            <RailRoute vagon={getCurrentVagon(current) ?? current.vagones?.[0]} />
            <div className="mt-6">
              <div className={s.progressCaption}>
                <span>Vagones concluidos</span>
                <strong>
                  {stats.concluidos} de {stats.total} · {stats.pct}%
                </strong>
              </div>
              <div className={s.progress}>
                <span style={{ width: `${stats.pct}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <p className={s.empty}>El patio está libre de arrastres activos.</p>
        )}
      </article>
      <article className={s.feature}>
        <header className={s.featureTop}>
          <h2 className={s.featureTitle}>
            <ListOrdered size={18} aria-hidden /> También en la cola
          </h2>
          <span className={s.count}>{next.length} visibles</span>
        </header>
        <div className={s.nextList}>
          {next.map((row) => (
            <div className={s.nextItem} key={row.id}>
              <span className={s.turn}>{row.ordenSolicitud ?? "—"}</span>
              <div className="min-w-0 flex-1">
                <strong>{buildArrastreFolio(row)}</strong>
                <p>{row.resumen?.totalVagones ?? row.vagones?.length ?? 0} vagones</p>
              </div>
              <StatusBadge status={row.estado} size="sm" />
            </div>
          ))}
        </div>
        {!next.length ? <p className={s.empty}>Sin más solicitudes en esta vista.</p> : null}
        <p className={s.sideNote}>
          <Info size={16} className="shrink-0" aria-hidden /> Vista de la cola cargada. Abre
          seguimiento para consultar todos los turnos.
        </p>
      </article>
    </section>
  );
}
