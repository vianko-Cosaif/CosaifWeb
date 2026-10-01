import type { ReactNode } from "react";
import { TrainFront } from "lucide-react";
import { GuidedTarget } from "@/features/capacitacion";
import type { OpenMeasuresModalArgs } from "@/features/torno-measures/useTornoMeasuresModal";
import type { Ronda, RondaInfo, RondaMovement } from "../types";
import { codeFrom, fmtLoco, formatDateTimeMX, movementIdFrom } from "../utils";
import styles from "./LocalityQueue.module.css";

type Props = {
  items: Ronda[];
  info: Record<number, RondaInfo>;
  loading: boolean;
  refreshing: boolean;
  nextCount: number;
  error?: string | null;
  title?: string;
  headingAs?: "h1" | "h2";
  showTiming?: boolean;
  onRefresh: () => void;
  onViewMeasures: (args: OpenMeasuresModalArgs) => void;
};

/** Presentation only: callers own data loading, scope, subscriptions and permissions. */
export default function LocalityQueue({
  items,
  info,
  loading,
  refreshing,
  nextCount,
  error,
  title = "Operación del patio",
  headingAs: Heading = "h2",
  showTiming = false,
  onRefresh,
  onViewMeasures,
}: Props) {
  const current = items[0];
  const next = items.slice(1, nextCount + 1);
  return (
    <div className={styles.queue} aria-busy={loading || refreshing}>
      <section className={styles.current}>
        <header className={styles.header}>
          <div>
            <Heading>{title}</Heading>
            <p>Orden actual de la localidad</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            title="Refrescar"
            className={styles.button}
          >
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </header>
        <GuidedTarget id="dashboard-current-movement">
          {loading && !current ? (
            <QueueSkeleton />
          ) : current ? (
            <QueueCard
              item={current}
              info={info[current.id]}
              current
              showTiming={showTiming}
              onViewMeasures={onViewMeasures}
            />
          ) : (
            <div className={styles.empty}>
              <TrainFront aria-hidden />
              <strong>{error ? "Tablero no disponible" : "Sin movimientos pendientes"}</strong>
              <p>
                {error
                  ? "Reintenta la consulta para cargar la operación."
                  : "No hay órdenes en la cola actualmente"}
              </p>
            </div>
          )}
        </GuidedTarget>
      </section>
      <GuidedTarget
        id="dashboard-rounds-queue"
        as="aside"
        className={styles.next}
        tabIndex={0}
        aria-label="Siguientes órdenes"
      >
        <header className={styles.header}>
          <h3>Siguientes órdenes</h3>
          <span>
            {next.length}/{nextCount}
          </span>
        </header>
        <div className={styles.list}>
          {loading && !next.length
            ? Array.from({ length: nextCount }, (_, index) => <QueueSkeleton key={index} />)
            : next.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  info={info[item.id]}
                  showTiming={showTiming}
                  onViewMeasures={onViewMeasures}
                />
              ))}
          {!loading && !error && !next.length && (
            <p className={styles.empty}>Sin movimientos pendientes</p>
          )}
        </div>
      </GuidedTarget>
    </div>
  );
}

function QueueCard({
  item,
  info,
  current = false,
  showTiming,
  onViewMeasures,
}: {
  item: Ronda;
  info?: RondaInfo;
  current?: boolean;
  showTiming: boolean;
  onViewMeasures: Props["onViewMeasures"];
}) {
  const movement = info?.movimiento ?? item.movimiento;
  const locomotive = fmtLoco(movement?.locomotiveNumber ?? movement?.locomotora);
  const company = info?.empresa?.nombre ?? item.empresa?.nombre ?? "—";
  const origin = movement?.viaOrigen?.nombre || "—";
  const destination = movement?.viaDestino?.nombre || "—";
  const movementId = movementIdFrom(item, info);
  const created =
    item.createdAt ?? movement?.fechaSolicitud ?? movement?.fechaInicio ?? movement?.fechaFin;
  const statusFields: Array<[string, ReactNode]> = [
    ["Estado", movement?.estado || "—"],
    ["Prioridad", movement?.prioridad || "—"],
  ];
  if (current) statusFields.push(["Orden", item.orden], ["Ronda", item.rondaNumero]);
  const dateFields: Array<[string, ReactNode]> = showTiming
    ? [
        ["Solicitud", formatDateTimeMX(movement?.fechaSolicitud)],
        ["Inicio", formatDateTimeMX(movement?.fechaInicio)],
        ["Fin", formatDateTimeMX(movement?.fechaFin)],
      ]
    : [["Creado", formatDateTimeMX(created, { fallback: "Sin fecha", dateStyle: "short" })]];

  return (
    <article className={styles.card} data-current={current}>
      <div className={styles.identity}>
        <TrainFront className={styles.train} aria-hidden />
        <div>
          <span>Locomotora</span>
          <strong>{locomotive}</strong>
          <p>{company}</p>
        </div>
        <div className={styles.code}>
          <span>Código</span>
          <strong>{codeFrom(info, item.id)}</strong>
          {!current && <p>Ronda #{item.rondaNumero}</p>}
        </div>
      </div>
      <FieldGrid
        fields={[
          ["Vía origen", origin],
          ["Vía destino", destination],
          ["Servicios", <Services key="services" movement={movement} />],
        ]}
      />
      <FieldGrid fields={statusFields} />
      <FieldGrid fields={dateFields} />
      <div className={styles.instructions}>
        <span>Comentarios / Instrucciones</span>
        <p>{movement?.instrucciones?.trim() || "Sin instrucciones adicionales."}</p>
      </div>
      {current && (
        <div className={styles.summary}>
          <p>
            Mover locomotora <b>{locomotive}</b> desde{" "}
            <b>
              {origin === "—"
                ? movement?.torno
                  ? "Torno"
                  : movement?.lavado
                    ? "Lavado"
                    : origin
                : origin}
            </b>{" "}
            hacia <b>{destination}</b>.
          </p>
          {showTiming && <FieldGrid fields={[["Creado", formatDateTimeMX(created)]]} />}
        </div>
      )}
      {movement?.torno && movementId ? (
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            onViewMeasures({ movementId, locomotiveLabel: locomotive, companyName: company })
          }
        >
          Ver mediciones
        </button>
      ) : null}
    </article>
  );
}

function FieldGrid({ fields }: { fields: Array<[string, ReactNode]> }) {
  return (
    <dl className={styles.fields} data-columns={fields.length}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Services({ movement }: { movement?: RondaMovement | null }) {
  return (
    <span className={styles.services}>
      <span data-active={!!movement?.lavado}>Lavado</span>
      <span data-active={!!movement?.torno}>Torno</span>
    </span>
  );
}

function QueueSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Cargando orden">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} />
      ))}
    </div>
  );
}
