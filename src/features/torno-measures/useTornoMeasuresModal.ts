"use client";

import { useCallback, useState } from "react";
import { parseTornoMedicionFromApi } from "@/app/movimientos/torno/tornoMeasureParser";
import {
  DEFAULT_TORNO_MEDICION_STATE,
  type TornoMedicionState,
} from "@/app/movimientos/crear/tornoMedicion.types";

export type MeasuresModalState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  tornoMedicion: TornoMedicionState;
  locomotiveLabel?: string;
  companyName?: string;
};

export type OpenMeasuresModalArgs = {
  movementId?: number | null;
  locomotiveLabel?: string;
  companyName?: string;
};

export function useTornoMeasuresModal(apiBase: string) {
  const [measuresModal, setMeasuresModal] = useState<MeasuresModalState>({
    open: false,
    loading: false,
    error: null,
    tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
  });

  const closeMeasuresModal = useCallback(() => {
    setMeasuresModal((prev) => ({ ...prev, open: false, error: null }));
  }, []);

  const openMeasuresModal = useCallback(
    async (args: OpenMeasuresModalArgs) => {
      const movementId = Number(args.movementId);
      if (!Number.isFinite(movementId) || movementId <= 0) return;

      setMeasuresModal({
        open: true,
        loading: true,
        error: null,
        tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
        locomotiveLabel: args.locomotiveLabel,
        companyName: args.companyName,
      });

      try {
        const response = await fetch(`${apiBase}/movimientos/${movementId}/edicion`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`No se pudo cargar medidas (${response.status}).`);
        }

        const payload = await response.json();
        setMeasuresModal((prev) => ({
          ...prev,
          loading: false,
          tornoMedicion: parseTornoMedicionFromApi(payload),
          locomotiveLabel: String(payload?.movimiento?.locomotiveNumber ?? args.locomotiveLabel ?? ""),
          companyName: payload?.movimiento?.empresa?.nombre ?? args.companyName,
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudieron cargar las medidas.";
        setMeasuresModal((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [apiBase]
  );

  return { measuresModal, openMeasuresModal, closeMeasuresModal };
}
