"use client";

import type { ReactNode } from "react";
import { Clock3, Info, MapPin, UserRound, AlertTriangle, type LucideIcon } from "lucide-react";
import { BadgeEstado, BadgeTipoMovimiento } from "@/features/movimientos/table/MovementBadges";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  dateLabel,
  movementIncidents,
  naturalTiming,
  personName,
  poleLabel,
  sectionPositionLabel,
  type QueueMovement,
  type QueueUnit,
} from "../queueView";

type Props = {
  unit: QueueUnit;
  movement: QueueMovement;
  showFinish: boolean;
  showWaitTime: boolean;
};

export default function NaturalMovementDetails({
  unit,
  movement,
  showFinish,
  showWaitTime,
}: Props) {
  const incidents = movementIncidents(unit, movement);
  const openIncidents = incidents.filter((incident) => incident.estado === "ABIERTO").length;
  const timing = naturalTiming(unit, movement);
  const instructions = movement.instrucciones
    ?.replace(/\[META (?:ORIGEN|DESTINO):\d+\]\s*/gi, "")
    .trim();
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DetailSection
        title="Operación de vía"
        icon={MapPin}
        color="border-l-emerald-400 dark:border-l-emerald-500"
      >
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-50 pb-2 text-xs dark:border-slate-800/50">
          <span className="text-slate-500 dark:text-slate-400">Tipo</span>
          <BadgeTipoMovimiento tipo={movement.tipoMovimiento} compact />
        </div>
        {(["Origen", "Destino"] as const).map((side) => (
          <div
            key={side}
            className="mb-3 border-b border-slate-50 pb-3 last:mb-0 last:border-0 last:pb-0 dark:border-slate-800/50"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">{side}</span>
              <strong
                className={
                  side === "Origen"
                    ? "text-sm text-emerald-700 dark:text-emerald-300"
                    : "text-sm text-sky-700 dark:text-sky-300"
                }
              >
                {movement[`via${side}NombreSnapshot`] ||
                  (movement[`via${side}Id`] ? `Vía #${movement[`via${side}Id`]}` : "Sin registrar")}
              </strong>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {sectionPositionLabel(
                movement[`seccion${side}Numero`],
                movement[`seccion${side}NombreSnapshot`],
                Boolean(movement[`seccion${side}Id`]),
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Polo de {side === "Origen" ? "salida" : "llegada"}:{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {poleLabel(movement[`polo${side}`])}
              </strong>
            </p>
          </div>
        ))}
      </DetailSection>
      <DetailSection
        title="Personal asignado"
        icon={UserRound}
        color="border-l-sky-400 dark:border-l-sky-500"
      >
        <dl>
          <InfoRow label="Cliente">
            {personName(
              movement.cliente ??
                (movement.clienteId === movement.creadoPorId ? movement.creadoPor : null),
              movement.clienteId,
              "Sin registrar",
            )}
          </InfoRow>
          <InfoRow label="Coordinador">
            {personName(movement.coordinador, movement.coordinadorId)}
          </InfoRow>
          <InfoRow label="Supervisor">
            {personName(movement.supervisor, movement.supervisorId)}
          </InfoRow>
          <InfoRow label="Maquinista">
            {personName(movement.operador ?? unit.operador, movement.operadorId ?? unit.operadorId)}
          </InfoRow>
          <InfoRow label="Solicitante">
            {personName(movement.creadoPor, movement.creadoPorId, "Sin registrar")}
          </InfoRow>
        </dl>
      </DetailSection>
      <DetailSection
        title="Fechas y tiempos"
        icon={Clock3}
        color="border-l-slate-300 dark:border-l-slate-600"
      >
        <dl>
          <InfoRow label="Solicitud">
            {dateLabel(movement.fechaSolicitud ?? unit.fechaRecepcion)}
          </InfoRow>
          <InfoRow label="Inicio">{dateLabel(movement.fechaInicio ?? unit.fechaInicio)}</InfoRow>
          {showFinish && (
            <InfoRow label="Fin">{dateLabel(movement.fechaFin ?? unit.fechaFin)}</InfoRow>
          )}
          {movement.fechaPausa && <InfoRow label="Pausa">{dateLabel(movement.fechaPausa)}</InfoRow>}
          {unit.fechaHabilitacion && (
            <InfoRow label="Reanudación habilitada">{dateLabel(unit.fechaHabilitacion)}</InfoRow>
          )}
          {showWaitTime && <InfoRow label={timing.label}>{timing.value}</InfoRow>}
        </dl>
      </DetailSection>
      <DetailSection
        title="Estado y seguimiento"
        icon={AlertTriangle}
        color="border-l-amber-400 dark:border-l-amber-500"
      >
        <div className="mb-3">
          {unit.estado === "LISTA_REANUDAR" ? (
            <StatusBadge
              status={movement.estado}
              label="Listo para continuar"
              tone="success"
              size="sm"
            />
          ) : (
            <BadgeEstado estado={movement.estado} />
          )}
        </div>
        <dl>
          <InfoRow label="Localidad">{movement.localidadNombreSnapshot || "Torreón"}</InfoRow>
          <InfoRow label="Empresa">
            {movement.empresaNombreSnapshot ||
              (movement.empresaId ? `Empresa #${movement.empresaId}` : "Sin registrar")}
          </InfoRow>
          <InfoRow label="Incidentes abiertos">{openIncidents}</InfoRow>
          {unit.modalidad === "CONJUNTO" && (
            <InfoRow label="Conjunto">
              #{unit.id} · {unit.totalIntegrantes ?? unit.movimientos.length} movimientos
            </InfoRow>
          )}
        </dl>
        {unit.incidenteBloqueanteId && (
          <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
            Ruta bloqueada · Incidente #{unit.incidenteBloqueanteId}
          </p>
        )}
      </DetailSection>
      <div className="col-span-1 md:col-span-2 xl:col-span-4">
        <div className="flex items-start gap-4 rounded-xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/30 dark:bg-slate-900/80">
          <span className="shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-900/40 dark:text-amber-500">
            <Info size={18} aria-hidden />
          </span>
          <div>
            <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">
              Instrucciones del movimiento
            </h4>
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
              {instructions || "Sin indicaciones adicionales."}
            </p>
            {unit.modalidad === "CONJUNTO" &&
            unit.totalIntegrantes &&
            unit.totalIntegrantes > unit.movimientos.length ? (
              <p className="mt-2 text-xs text-slate-500">
                Se muestran {unit.movimientos.length} de los {unit.totalIntegrantes} movimientos del
                conjunto.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: LucideIcon;
  color: string;
  children: ReactNode;
}) {
  return (
    <section className="h-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h4
        className={`mb-3 flex items-center gap-2 border-b border-l-2 border-slate-100 pb-2 pl-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 ${color}`}
      >
        <Icon size={12} aria-hidden />
        {title}
      </h4>
      {children}
    </section>
  );
}
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-50 py-1.5 text-xs last:border-0 dark:border-slate-800/50">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {children}
      </dd>
    </div>
  );
}
