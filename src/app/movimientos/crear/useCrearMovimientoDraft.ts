import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { DRAFT_KEY, type MovementFormData } from "../movimientos.shared";
import type { LocomotoraBloqueada } from "./controller.types";
import {
  DEFAULT_TORNO_MEDICION_STATE,
  normalizeTornoMeasureValue,
  isTornoWheelCount,
  TORNO_FIELD_KEYS,
  TORNO_POSITION_KEYS,
  type TornoMeasurementRow,
  type TornoMeasurementValue,
  type TornoMedicionState,
} from "./tornoMedicion.types";

/**
 * MODULO: useCrearMovimientoDraft
 *
 * Responsabilidad:
 * - Persistir el estado del wizard en localStorage.
 * - Restaurar estado previo tras recarga.
 *
 * Este archivo NO:
 * - Valida campos.
 * - Llama APIs remotas.
 * - Decide navegacion del wizard.
 */

type DraftPayload = {
  form: MovementFormData;
  fromSection?: number;
  toSection?: number;
  locoLockedBy: LocomotoraBloqueada | null;
  tornoMedicion: TornoMedicionState;
  tornoStep2Completed?: boolean;
  tornoMovimientoId?: number | null;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function parseLegacyMeasureString(raw: string): TornoMeasurementValue {
  const input = raw.trim();
  if (!input) return { whole: "", num: "", den: "" };

  const onlyWhole = input.match(/^(\d+)\s*"?$/);
  if (onlyWhole) {
    return normalizeTornoMeasureValue({
      whole: onlyWhole[1],
      num: "",
      den: "",
    });
  }

  const mixed = input.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*"?$/);
  if (mixed) {
    return normalizeTornoMeasureValue({
      whole: mixed[1] || "",
      num: mixed[2] || "",
      den: mixed[3] || "",
    });
  }

  return { whole: "", num: "", den: "" };
}

function readMeasureValue(raw: unknown): TornoMeasurementValue {
  if (typeof raw === "string") return parseLegacyMeasureString(raw);
  if (!isObjectRecord(raw)) return { whole: "", num: "", den: "" };
  return normalizeTornoMeasureValue({
    whole: String(raw.whole ?? ""),
    num: String(raw.num ?? ""),
    den: String(raw.den ?? ""),
  });
}

function readMeasurementRow(raw: unknown): TornoMeasurementRow {
  const source = isObjectRecord(raw) ? raw : {};
  const out = {} as TornoMeasurementRow;
  for (const field of TORNO_FIELD_KEYS) {
    out[field] = readMeasureValue(source[field]);
  }
  return out;
}

function readMeasurementRows(raw: unknown): TornoMedicionState["rows"] {
  const source = isObjectRecord(raw) ? raw : {};
  const out: TornoMedicionState["rows"] = {};
  for (const position of TORNO_POSITION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, position)) continue;
    const row = readMeasurementRow(source[position]);

    const hasAnyValue = TORNO_FIELD_KEYS.some((field) => {
      const value = row[field];
      return value.whole || value.num || value.den;
    });

    if (hasAnyValue) out[position] = row;
  }
  return out;
}

/**
 * Hook de persistencia local (draft).
 *
 * Entradas:
 * - Estado actual del wizard.
 * - Setters para restaurar estado.
 *
 * Salidas:
 * - hydrateDraft(): rehidrata si hay snapshot.
 * - clearDraft(): elimina snapshot persistido.
 */
export function useCrearMovimientoDraft(args: {
  form: MovementFormData;
  fromSection?: number;
  toSection?: number;
  locoLockedBy: LocomotoraBloqueada | null;
  tornoMedicion: TornoMedicionState;
  tornoStep2Completed?: boolean;
  tornoMovimientoId?: number | null;
  setForm: Dispatch<SetStateAction<MovementFormData>>;
  setFromSection: Dispatch<SetStateAction<number | undefined>>;
  setToSection: Dispatch<SetStateAction<number | undefined>>;
  setLocoLockedBy: Dispatch<SetStateAction<LocomotoraBloqueada | null>>;
  setTornoMedicion: Dispatch<SetStateAction<TornoMedicionState>>;
  setTornoStep2Completed?: Dispatch<SetStateAction<boolean>>;
  setTornoMovimientoId?: Dispatch<SetStateAction<number | null>>;
}) {
  const {
    form,
    fromSection,
    toSection,
    locoLockedBy,
    tornoMedicion,
    tornoStep2Completed,
    tornoMovimientoId,
    setForm,
    setFromSection,
    setToSection,
    setLocoLockedBy,
    setTornoMedicion,
    setTornoStep2Completed,
    setTornoMovimientoId,
  } = args;

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Autosave con debounce corto para no bloquear UI. */
  useEffect(() => {
    const payload: DraftPayload = {
      form,
      fromSection,
      toSection,
      locoLockedBy,
      tornoMedicion,
      // Estos estados son de una corrida ya enviada al backend. No deben
      // sobrevivir recargas porque hacen que el wizard salte de medicion a PDF.
      tornoStep2Completed: false,
      tornoMovimientoId: null,
    };
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch { }
    }, 350);

    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [form, fromSection, toSection, locoLockedBy, tornoMedicion, tornoStep2Completed, tornoMovimientoId]);

  /** Restaura draft previo si existe. */
  const hydrateDraft = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
      if (!raw) return;

      const d = JSON.parse(raw) as Partial<DraftPayload>;
      setForm((p) => ({ ...p, ...d.form }));
      setFromSection(d.fromSection);
      setToSection(d.toSection);
      setLocoLockedBy(d.locoLockedBy || null);
      if (d.tornoMedicion && typeof d.tornoMedicion === "object") {
        const safeWheelCount = isTornoWheelCount(d.tornoMedicion.wheelCount)
          ? d.tornoMedicion.wheelCount
          : DEFAULT_TORNO_MEDICION_STATE.wheelCount;
        const safeRows = readMeasurementRows(d.tornoMedicion.rows);
        setTornoMedicion({
          wheelCount: safeWheelCount,
          rows: safeRows,
        });
      } else {
        setTornoMedicion(DEFAULT_TORNO_MEDICION_STATE);
      }

      if (setTornoMovimientoId) {
        setTornoMovimientoId(null);
      }

      if (setTornoStep2Completed) {
        setTornoStep2Completed(false);
      }
    } catch { }
  }, [setForm, setFromSection, setToSection, setLocoLockedBy, setTornoMedicion, setTornoStep2Completed, setTornoMovimientoId]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch { }
  }, []);

  return {
    hydrateDraft,
    clearDraft,
  };
}
