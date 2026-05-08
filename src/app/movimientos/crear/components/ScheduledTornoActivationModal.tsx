import React, { useEffect, useMemo, useState } from "react";
import { Movimiento } from "../../Movimiento";
import { API_BASE } from "../../movimientos.shared";
import { DynamicTable, type DynamicTableColumn } from "@/app/Components/dynamic-table";

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
};

type Props = {
  enabled: boolean;
  locomotiveNumber: string;
  onActivate: (movement: ScheduledTornoMovement) => Promise<void> | void;
};

type MeasureRow = {
  position: string;
  [key: string]: string;
};

const MEASURE_FIELDS = [
  { key: "alturaCeja", label: "Altura de Ceja" },
  { key: "espesorCeja", label: "Espesor de Ceja" },
  { key: "caidaVertical", label: "Caida Vertical" },
  { key: "espesorPestana", label: "Espesor de Pestana" },
  { key: "trazoEntreCaras", label: "Trazado Entre Caras" },
  { key: "diametroPromedio", label: "Diametro Promedio" },
  { key: "gruesoRueda", label: "Grueso de Rueda" },
  { key: "desgastePisada", label: "Desgaste de Pisada" },
  { key: "tramoMancuerna", label: "Tramo de Mancuerna" },
  { key: "diametroRueda", label: "Diametro de Rueda" },
  { key: "lectura", label: "Lectura" },
] as const;

const WHEEL_ORDER = ["l1", "r1", "l2", "r2", "l3", "r3", "l4", "r4", "l5", "r5", "l6", "r6"] as const;

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const labelToFieldKey = new Map(MEASURE_FIELDS.map((field) => [normalizeLabel(field.label), field.key]));

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

const parseWheelSummary = (summary: unknown): Record<string, string> => {
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

const buildMeasureRows = (medidas: unknown): MeasureRow[] => {
  if (!medidas || typeof medidas !== "object") return [];
  const source = medidas as Record<string, unknown>;
  return WHEEL_ORDER
    .filter((position) => Object.prototype.hasOwnProperty.call(source, position) && hasScheduledMeasure(source[position]))
    .map((position) => {
      const row: MeasureRow = { position: position.toUpperCase() };
      for (const field of MEASURE_FIELDS) row[field.key] = "-";
      return { ...row, ...parseWheelSummary(source[position]) };
    });
};

export default function ScheduledTornoActivationModal(props: Props) {
  const { enabled, locomotiveNumber, onActivate } = props;
  const [debouncedLocomotive, setDebouncedLocomotive] = useState("");
  const [match, setMatch] = useState<ScheduledTornoMovement | null>(null);
  const [dismissedMatchId, setDismissedMatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);

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
    if (!locomotiveNumber.trim()) {
      setDismissedMatchId(null);
    }
  }, [locomotiveNumber]);

  useEffect(() => {
    if (!debouncedLocomotive) {
      setMatch(null);
      return;
    }

    let alive = true;
    setLoading(true);
    Movimiento.fetchWithTimeout(
      `${API_BASE}/movimientos/torno/agendados/activable?locomotiveNumber=${encodeURIComponent(debouncedLocomotive)}`,
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json", ...Movimiento.tokenHeader() },
      }
    )
      .then(async (res) => {
        const text = await res.text();
        const data = text ? Movimiento.safeJSON(text) : {};
        if (!alive) return;
        setMatch(res.ok && data?.activable ? data.scheduledMovement ?? null : null);
      })
      .catch(() => {
        if (alive) setMatch(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [debouncedLocomotive]);

  const matchId = Number(match?.id ?? 0);
  const open = !!match && matchId !== dismissedMatchId;
  const rows = useMemo(() => buildMeasureRows(match?.medidasTorno), [match?.medidasTorno]);
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
      ...MEASURE_FIELDS.map<DynamicTableColumn<MeasureRow>>((field) => ({
        key: field.key,
        title: field.label,
        width: 190,
        priority: 2,
        render: ({ value }) => (
          <span className="font-semibold text-slate-800 dark:text-slate-100">{String(value || "-")}</span>
        ),
      })),
    ],
    []
  );

  if (!open) {
    return loading && enabled && locomotiveNumber.trim() ? (
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Buscando movimientos agendados...</div>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Movimiento de torno agendado encontrado</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Solicitud #{match?.id ?? "-"} para locomotora {match?.locomotiveNumber ?? "-"}
              </p>
            </div>
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

        <div className="max-h-[calc(92vh-64px)] overflow-y-auto p-4">
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            <div>Programada: <strong>{formatDate(match?.fechaProgramada)}</strong></div>
            <div className="mt-1">Limite de activacion: <strong>{formatDate(match?.fechaLimiteActivacion)}</strong></div>
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
              {activating ? "Activando..." : "Activar Movimiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
