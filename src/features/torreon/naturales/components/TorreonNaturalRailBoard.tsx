"use client";

import { ArrowDownRight, ArrowUpLeft, Clock3, RefreshCw, Route, TrainFront } from "lucide-react";
import { S } from "@/app/coordinador/RailQueueBoard.styles";
import {
  TerminalQueueTable,
  fmtLoco,
  formatDateTimeMX,
  type Ronda,
  type RondaInfo,
} from "@/features/rail-queue";
import type { MovimientoNatural } from "../types";

type Props = {
  rows: MovimientoNatural[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function TorreonNaturalRailBoard({ rows, loading, error, onRefresh }: Props) {
  const { items, info } = adaptTorreonQueue(rows);
  const current = items[0];
  const currentInfo = current ? info[current.id] : undefined;
  const currentMovement = currentInfo?.movimiento;
  const next = items.slice(1, 6);
  const origin = currentMovement?.viaOrigen?.nombre || "—";
  const destination = currentMovement?.viaDestino?.nombre || "—";
  const locomotive = fmtLoco(currentMovement?.locomotiveNumber ?? currentMovement?.locomotora);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            LIVE
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rondas naturales de Torreón</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Actualizar
        </button>
      </div>

      <div className={S.section}>
        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <div className={S.grid}>
          <div className={S.leftCol}>
            <div className={S.leftHeader}>
              <div>
                <h2 className={S.title}>Tablero de Rondas</h2>
                <div className={S.subtitle}>Orden Actual · Current Move</div>
              </div>
              <button type="button" onClick={onRefresh} disabled={loading} className={S.refreshPill}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div className={S.currentCard}>
              {loading && !current ? (
                <CurrentSkeleton />
              ) : current ? (
                <>
                  <div className={S.currentTop}>
                    <div className={S.currentTopLeft}>
                      <div className={S.locoBubble}>
                        <TrainFront className="h-6 w-6" aria-hidden />
                      </div>
                      <div>
                        <div className={S.companyName}>{currentInfo?.empresa?.nombre || "—"}</div>
                      </div>
                    </div>
                    <div className={S.currentTopRight}>
                      <div className={S.locoLabel}>LOCOMOTORA</div>
                      <div className={S.locoValue}>{locomotive}</div>
                    </div>
                  </div>

                  <div className={S.infoGrid}>
                    <BoardInfo icon={ArrowUpLeft} label="Via origen" value={origin} />
                    <BoardInfo icon={ArrowDownRight} label="Via destino" value={destination} />
                    <BoardInfo icon={Route} label="Movimiento" value={currentMovement?.prioridad || "Prioridad normal"} />
                  </div>

                  <div className={S.badgeGrid}>
                    <BoardBadge label="Estado" value={currentMovement?.estado || "—"} />
                    <BoardBadge label="Prioridad" value={currentMovement?.prioridad || "—"} />
                    <BoardBadge label="Orden" value={String(current.orden)} />
                    <BoardBadge label="Ronda" value={String(current.rondaNumero)} />
                  </div>

                  <div className={S.detailBox}>
                    <p className={S.detailLabel}>Detalle del movimiento</p>
                    <p className={S.detailText}>
                      Mover locomotora <b className="text-sky-700 dark:text-sky-300">{locomotive}</b> desde{" "}
                      <b className="text-emerald-700 dark:text-emerald-300">{origin}</b> hacia{" "}
                      <b className="text-emerald-700 dark:text-emerald-300">{destination}</b>.
                    </p>
                    <div className={S.createdWrap}>
                      <DateBox label="Creado" value={formatBoardDate(current.createdAt ?? currentMovement?.fechaSolicitud)} />
                    </div>
                    <p className={S.instructions}>
                      <span className="font-semibold">Instrucciones: </span>
                      {currentMovement?.instrucciones?.trim() || "Sin instrucciones adicionales."}
                    </p>
                  </div>
                </>
              ) : (
                <div className={S.emptyWrap}>
                  <TrainFront className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" aria-hidden />
                  <div className={S.emptyTitle}>Sin movimientos pendientes</div>
                  <div className={S.emptyDesc}>No hay órdenes en la cola actualmente</div>
                </div>
              )}
            </div>
          </div>

          <aside className={S.aside}>
            <div className={S.asideHeader}>
              <h3 className={S.asideTitle}>
                <Clock3 className="h-5 w-5" aria-hidden />
                Próximas Órdenes
              </h3>
              <span className={S.asideCount}>{next.length}/5</span>
            </div>
            <div className={S.nextWrap}>
              {loading && !next.length ? (
                Array.from({ length: 3 }).map((_, index) => <NextSkeleton key={index} />)
              ) : next.length ? (
                next.map((item) => <NextOrder key={item.id} item={item} info={info[item.id]} />)
              ) : (
                <div className={S.nextEmpty}>
                  <TrainFront className="mx-auto mb-3 h-9 w-9 text-slate-300 dark:text-slate-700" aria-hidden />
                  Sin movimientos pendientes
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="px-3 pb-5 sm:px-4 md:px-6 lg:px-8">
        <TerminalQueueTable items={items} info={info} loading={loading} onViewMeasures={() => undefined} />
      </div>
    </section>
  );
}

function adaptTorreonQueue(rows: MovimientoNatural[]) {
  const sorted = [...rows].sort((a, b) =>
    (a.rondaNumero ?? Number.MAX_SAFE_INTEGER) - (b.rondaNumero ?? Number.MAX_SAFE_INTEGER) ||
    (a.ordenRonda ?? Number.MAX_SAFE_INTEGER) - (b.ordenRonda ?? Number.MAX_SAFE_INTEGER) ||
    Number(a.id) - Number(b.id)
  );
  const items: Ronda[] = [];
  const info: Record<number, RondaInfo> = {};

  sorted.forEach((row, index) => {
    const id = toPositiveNumber(row.id, index + 1);
    const movementId = toPositiveNumber(row.id, id);
    const empresa = { id: row.empresaId ?? 0, nombre: row.empresaNombre || row.clienteNombre || "—" };
    const movement: Ronda["movimiento"] = {
      id: movementId,
      idTecnico: row.idTecnico ?? row.id,
      folioLocalidad: row.folioLocalidad ?? null,
      folioLocalidadLabel: row.folioLocalidadLabel ?? null,
      viaOrigen: { nombre: row.viaOrigen || "—" },
      viaDestino: { nombre: row.viaDestino || "—" },
      lavado: false,
      torno: false,
      estado: row.estado || "SOLICITADO",
      prioridad: row.prioridad === "ALTA" ? "ALTA" : "BAJA",
      locomotiveNumber: row.locomotiveNumber,
      fechaSolicitud: row.fechaSolicitud,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      instrucciones: row.instrucciones,
    };
    const ronda: Ronda = {
      id,
      rondaNumero: row.rondaNumero ?? Math.floor(index / 3) + 1,
      orden: row.ordenRonda ?? (index % 3) + 1,
      concluido: false,
      empresa,
      movimiento: movement,
      movimientoId: movementId,
      createdAt: row.fechaSolicitud,
    };
    items.push(ronda);
    info[id] = {
      empresa,
      movimiento: {
        ...movement,
        lavado: false,
        torno: false,
        estado: row.estado || "SOLICITADO",
        prioridad: row.prioridad === "ALTA" ? "ALTA" : "BAJA",
        locomotiveNumber: row.locomotiveNumber ?? undefined,
      },
      movimientoId: movementId,
    };
  });

  return { items, info };
}

function NextOrder({ item, info }: { item: Ronda; info: RondaInfo }) {
  const movement = info.movimiento;
  return (
    <article className={S.nextCard}>
      <div className={S.nextHeader}>
        <div className={S.nextIconWrap}><TrainFront className="h-5 w-5" aria-hidden /></div>
        <div className={S.nextMeta}>
          <div className={S.nextMetaLabel}>Locomotora</div>
          <div className={S.nextMetaValue}>{fmtLoco(movement.locomotiveNumber ?? movement.locomotora)}</div>
          <div className={S.nextMetaLabel}>Empresa</div>
          <div className={S.nextMetaValue}>{info.empresa.nombre}</div>
        </div>
        <div className={S.nextRight}>Ronda #{item.rondaNumero}</div>
      </div>
      <div className={S.kvGrid}>
        <KeyValue label="Origen" value={movement.viaOrigen?.nombre || "—"} />
        <KeyValue label="Destino" value={movement.viaDestino?.nombre || "—"} />
      </div>
      <div className={S.kvGrid}>
        <KeyValue label="Estado" value={movement.estado || "—"} strong />
        <KeyValue label="Prioridad" value={movement.prioridad || "—"} />
      </div>
      <p className={S.nextExtra}>
        <span className="font-semibold">Creado: </span>{formatBoardDate(item.createdAt ?? movement.fechaSolicitud)}
      </p>
    </article>
  );
}

function BoardInfo({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <div className={S.infoCard}>
      <div className={S.infoCardLabel}><Icon className="h-4 w-4" aria-hidden />{label}</div>
      <div className={S.infoCardValue}>{value}</div>
    </div>
  );
}

function BoardBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className={S.infoBadge}>
      <div className={S.infoBadgeLabel}>{label}</div>
      <div className={S.infoBadgeValue}>{value}</div>
    </div>
  );
}

function KeyValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? S.kvBoxStrong : S.kvBox}>
      <div className={S.kvLabel}>{label}</div>
      <div className={S.kvValue}>{value}</div>
    </div>
  );
}

function DateBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={S.dateBox}>
      <div className={S.dateBoxLabel}>{label}</div>
      <div className={S.dateBoxValue}>{value}</div>
    </div>
  );
}

function CurrentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-16 rounded-lg bg-slate-100 dark:bg-slate-900" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-900" />)}
      </div>
      <div className="h-28 rounded-lg bg-slate-100 dark:bg-slate-900" />
    </div>
  );
}

function NextSkeleton() {
  return <div className="h-36 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />;
}

function formatBoardDate(value?: string | null) {
  return formatDateTimeMX(value, { fallback: "Sin fecha", dateStyle: "short" });
}

function toPositiveNumber(value: number | string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
