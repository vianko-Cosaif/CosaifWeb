"use client";
import { ListOrdered, RefreshCw, TrainFront } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { fmtDate } from "../../arrastres/utils";
import { RailRoute } from "../../presentation/RailPrimitives";
import s from "../../presentation/rail.module.scss";
import type { MovimientoNatural } from "../types";

type Props = {
  rows: MovimientoNatural[];
  loading: boolean;
  error: string | null;
  realtimeConnected?: boolean;
  onRefresh: () => void;
};
export function TorreonNaturalRailBoard({
  rows,
  loading,
  error,
  realtimeConnected = false,
  onRefresh,
}: Props) {
  const current = rows.find((row) => row.estado === "EN_PROCESO") ?? rows[0];
  const next = rows.filter((row) => row.id !== current?.id);
  return (
    <section className={s.workspace}>
      <header className={s.pageHeader}>
        <div>
          <p className={s.eyebrow}>Torreón · Locomotoras</p>
          <h2 className={s.title}>Rondas naturales</h2>
          <p className={s.subtitle}>Recorridos y prioridades de las locomotoras del patio.</p>
        </div>
        {!realtimeConnected ? (
          <button type="button" className={s.button} disabled={loading} onClick={onRefresh}>
            <RefreshCw size={15} aria-hidden />
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        ) : null}
      </header>
      {error ? (
        <p role="alert" className={s.instructions}>
          {error}
        </p>
      ) : null}
      {loading && !rows.length ? (
        <div className={s.loading} role="status">
          Cargando rondas…
        </div>
      ) : !current ? (
        <p className={s.empty}>No hay rondas activas en el patio.</p>
      ) : (
        <>
          <div className={s.focusGrid}>
            <article className={s.feature}>
              <header className={s.featureTop}>
                <h3 className={s.featureTitle}>
                  <TrainFront size={18} aria-hidden />
                  {current.estado === "EN_PROCESO"
                    ? "Locomotora en movimiento"
                    : "Próxima locomotora"}
                </h3>
                <StatusBadge status={current.estado} size="sm" />
              </header>
              <div className={s.featureBody}>
                <div className={s.reference}>
                  <h3>{current.locomotiveNumber ?? "Sin número"}</h3>
                  <span>{current.empresaNombre || "Empresa sin especificar"}</span>
                </div>
                <div className={s.naturalRoute}>
                  <NaturalRoute row={current} />
                </div>
                <dl className={s.timeline}>
                  <div>
                    <dt>Ronda / orden</dt>
                    <dd>
                      {current.rondaNumero ?? "—"} / {current.ordenRonda ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Prioridad</dt>
                    <dd>{current.prioridad === "ALTA" ? "Alta" : "Normal"}</dd>
                  </div>
                  <div>
                    <dt>Solicitud</dt>
                    <dd>{fmtDate(current.fechaSolicitud)}</dd>
                  </div>
                </dl>
                {current.instrucciones ? (
                  <p className={s.instructions}>{current.instrucciones}</p>
                ) : null}
                <p className={s.scopeNote}>
                  Inicio: {fmtDate(current.fechaInicio)} · Fin: {fmtDate(current.fechaFin)}
                </p>
              </div>
            </article>
            <article className={s.feature}>
              <header className={s.featureTop}>
                <h3 className={s.featureTitle}>
                  <ListOrdered size={18} aria-hidden />
                  Siguientes locomotoras
                </h3>
                <span className={s.count}>{next.length}</span>
              </header>
              <div className={s.nextList}>
                {next.slice(0, 3).map((row) => (
                  <div className={s.nextItem} key={row.id}>
                    <span className={s.turn}>{row.ordenRonda ?? "—"}</span>
                    <div className="min-w-0 flex-1">
                      <strong>{row.locomotiveNumber ?? "Sin número"}</strong>
                      <p>{row.empresaNombre || "Empresa sin especificar"}</p>
                    </div>
                    <StatusBadge status={row.estado} size="sm" />
                  </div>
                ))}
              </div>
              {!next.length ? <p className={s.empty}>Sin más locomotoras en esta vista.</p> : null}
              <p className={s.sideNote}>
                Se muestran las primeras {rows.length} rondas cargadas. Consulta Movimientos para
                ver el detalle completo.
              </p>
            </article>
          </div>
          <section className={s.queue}>
            <header className={s.queueHeader}>
              <div>
                <h2>Cola de locomotoras</h2>
                <p>Orden, recorrido y estado de cada ronda</p>
              </div>
              <span className={s.count}>{rows.length} rondas</span>
            </header>
            {rows.map((row) => (
              <article className={s.queueRow} key={row.id}>
                <div className={s.rowMain}>
                  <div className={s.rowIdentity}>
                    <TrainFront size={20} aria-hidden />
                    <div>
                      <strong>{row.locomotiveNumber ?? "Sin número"}</strong>
                      <small>
                        Ronda {row.rondaNumero ?? "—"} · Orden {row.ordenRonda ?? "—"}
                      </small>
                    </div>
                  </div>
                  <div className={s.rowRoute}>
                    <p>{row.empresaNombre || "Empresa sin especificar"}</p>
                    <NaturalRoute row={row} />
                  </div>
                  <div className={s.rowProgress}>
                    <p className={s.scopeNote}>{fmtDate(row.fechaSolicitud)}</p>
                  </div>
                  <div className={s.rowEnd}>
                    <StatusBadge status={row.estado} size="sm" />
                    {row.prioridad === "ALTA" ? <StatusBadge status="ALTA" size="sm" /> : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
function NaturalRoute({ row }: { row: MovimientoNatural }) {
  return (
    <RailRoute
      vagon={{
        id: Number(row.id) || 0,
        orden: row.ordenRonda ?? 0,
        viaOrigenNombre: row.viaOrigen,
        viaDestinoNombre: row.viaDestino,
      }}
    />
  );
}
