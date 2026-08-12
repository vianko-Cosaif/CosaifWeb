import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DynamicTable, type DynamicTableColumn } from "@/app/Components/dynamic-table";
import { resolveTornoProfile, TORNO_PROFILE_FIELDS, type TornoFieldDef } from "../tornoProfiles";

export type ScheduledTornoMovement = {
  id: number;
  locomotiveNumber?: number | string | null;
  empresaId?: number | null;
  localidadId?: number | null;
  viaOrigenId?: number | null;
  viaDestinoId?: number | null;
  tipoMovimiento?: string | null;
  prioridad?: string | null;
  direccionEmpuje?: string | null;
  posicionCabina?: string | null;
  posicionChimenea?: string | null;
  polo?: string | null;
  fechaProgramada?: string | null;
  fechaLimiteActivacion?: string | null;
  medidasTorno?: Record<string, unknown> | null;
  instrucciones?: string | null;
  tipo?: string | null;
  temporaryRecovery?: boolean;
  recovery?: boolean;
  usuarioIntentoNombre?: string | null;
  fechaIntento?: string | null;
};

type Props = {
  enabled: boolean;
  locomotiveNumber: string;
  viaOrigenId?: number | null;
  localidadId?: number | null;
  scheduledMovements?: ScheduledTornoMovement[];
  loading?: boolean;
  companyName?: string;
  onRefresh?: () => Promise<void> | void;
  onActivate: (movement: ScheduledTornoMovement) => Promise<void> | void;
};

type MeasureRow = {
  position: string;
  [key: string]: string;
};

const WHEEL_ORDER = ["l1", "r1", "l2", "r2", "l3", "r3", "l4", "r4", "l5", "r5", "l6", "r6"] as const;

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const hasScheduledMeasure = (summary: unknown) => {
  const value = String(summary ?? "").trim();
  return value.length > 0 && value.toUpperCase() !== "NO_APLICA";
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseWheelSummary = (summary: unknown, fieldDefs: TornoFieldDef[]): Record<string, string> => {
  const labelToFieldKey = new Map(fieldDefs.map((field) => [normalizeLabel(field.label), field.key]));
  const row: Record<string, string> = {};
  String(summary ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf(":");
      if (separatorIndex < 0) return;
      const label = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      const key = labelToFieldKey.get(normalizeLabel(label));
      if (key) row[key] = value || "-";
    });
  return row;
};

const buildProfileMeasureRows = (medidas: unknown, fieldDefs: TornoFieldDef[]): MeasureRow[] => {
  if (!medidas || typeof medidas !== "object") return [];
  const source = medidas as Record<string, unknown>;
  return WHEEL_ORDER
    .filter((position) => Object.prototype.hasOwnProperty.call(source, position) && hasScheduledMeasure(source[position]))
    .map((position) => {
      const row: MeasureRow = { position: position.toUpperCase() };
      for (const field of fieldDefs) row[field.key] = "-";
      return { ...row, ...parseWheelSummary(source[position], fieldDefs) };
    });
};

export default function ScheduledTornoActivationModal(props: Props) {
  const {
    enabled,
    locomotiveNumber,
    scheduledMovements = [],
    loading = false,
    companyName,
    onRefresh,
    onActivate,
  } = props;
  const [debouncedLocomotive, setDebouncedLocomotive] = useState("");
  const [dismissedMatchId, setDismissedMatchId] = useState<number | null>(null);
  const [activating, setActivating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const value = locomotiveNumber.trim();
    if (!enabled || !/^\d+$/.test(value)) {
      setDebouncedLocomotive("");
      return;
    }
    const timeoutId = window.setTimeout(() => setDebouncedLocomotive(value), 350);
    return () => window.clearTimeout(timeoutId);
  }, [enabled, locomotiveNumber]);

  useEffect(() => {
    setDismissedMatchId(null);
  }, [locomotiveNumber]);

  useEffect(() => {
    if (!locomotiveNumber.trim()) {
      setDismissedMatchId(null);
    }
  }, [locomotiveNumber]);

  const match = useMemo(() => {
    if (!debouncedLocomotive) return null;
    const now = Date.now();
    return scheduledMovements.find((item) => {
      const sameLocomotive = Number(item?.locomotiveNumber) === Number(debouncedLocomotive);
      if (!sameLocomotive) return false;
      const isRecovery =
        item?.temporaryRecovery === true ||
        item?.recovery === true ||
        String(item?.tipo ?? "").toUpperCase() === "TORNO_RECUPERACION";
      const limit = item?.fechaLimiteActivacion ? new Date(item.fechaLimiteActivacion).getTime() : null;
      const inWindow = !limit || Number.isNaN(limit) || now <= limit;
      if (!inWindow) return false;
      if (isRecovery) return true;
      return true;
    }) ?? null;
  }, [debouncedLocomotive, scheduledMovements]);

  const matchId = Number(match?.id ?? 0);
  const open = !!match && matchId !== dismissedMatchId;
  const isRecovery =
    match?.temporaryRecovery === true ||
    match?.recovery === true ||
    String(match?.tipo ?? "").toUpperCase() === "TORNO_RECUPERACION";
  const recoveryUserName = String(match?.usuarioIntentoNombre || "correspondiente");
  const recoveryAttemptDate = formatDate(match?.fechaIntento ?? match?.fechaProgramada);
  const fieldDefs = useMemo(() => TORNO_PROFILE_FIELDS[resolveTornoProfile(companyName)], [companyName]);
  const rows = useMemo(() => buildProfileMeasureRows(match?.medidasTorno, fieldDefs), [fieldDefs, match?.medidasTorno]);
  const columns = useMemo<DynamicTableColumn<MeasureRow>[]>(
    () => [
      {
        key: "position",
        title: "Rueda",
        width: 92,
        priority: 1,
        render: ({ row }) => (
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{row.position}</span>
        ),
      },
      ...fieldDefs.map<DynamicTableColumn<MeasureRow>>((field) => ({
        key: field.key,
        title: field.label,
        width: 190,
        priority: 2,
        render: ({ value }) => (
          <span className="font-semibold text-slate-800 dark:text-slate-100">{String(value || "-")}</span>
        ),
      })),
    ],
    [fieldDefs]
  );

  if (!open) {
    return loading && enabled && locomotiveNumber.trim() ? (
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Buscando movimientos agendados...</div>
    ) : null;
  }

  const modal = (
    <div className="fixed inset-0 z-[9990] flex min-h-screen w-screen items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <div
        className="flex max-h-[min(92vh,860px)] w-[min(1180px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,.36)] dark:border-slate-800 dark:bg-slate-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduled-torno-title"
      >
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 id="scheduled-torno-title" className="text-base font-semibold text-slate-900 dark:text-white">
                {isRecovery ? "Torneado cancelado recuperable" : "Movimiento de torno agendado encontrado"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {isRecovery
                  ? `Guardado temporal para locomotora ${match?.locomotiveNumber ?? "-"}`
                  : `Solicitud #${match?.id ?? "-"} para locomotora ${match?.locomotiveNumber ?? "-"}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onRefresh?.()}
                disabled={loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={() => setDismissedMatchId(matchId || null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Cerrar"
              >
                x
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            <div>Programada: <strong>{formatDate(match?.fechaProgramada)}</strong></div>
            <div className="mt-1">Limite de activacion: <strong>{formatDate(match?.fechaLimiteActivacion)}</strong></div>
            {isRecovery ? (
              <div className="mt-2 font-medium text-amber-700 dark:text-amber-300">
                El usuario {recoveryUserName} intentó realizar este movimiento en la fecha {recoveryAttemptDate}. ¿Deseas reintentarlo y recuperar las medidas solicitadas?
              </div>
            ) : null}
          </div>

          <DynamicTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.position}
            height={Math.min(420, 110 + Math.max(1, rows.length) * 46)}
            rowHeight={46}
            headerHeight={42}
            emptyText="Sin medidas registradas"
            stickyFirstColumn
          />

          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setDismissedMatchId(matchId || null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={activating}
              onClick={async () => {
                if (!match) return;
                setActivating(true);
                try {
                  await onActivate(match);
                  setDismissedMatchId(matchId || null);
                } finally {
                  setActivating(false);
                }
              }}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow shadow-emerald-500/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activating ? (isRecovery ? "Recuperando..." : "Activando...") : (isRecovery ? "Recuperar datos" : "Activar Movimiento")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}
