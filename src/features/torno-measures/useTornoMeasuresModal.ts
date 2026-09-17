"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseTornoMedicionFromApi } from "@/features/movimientos/torno/tornoMeasureParser";
import {
  DEFAULT_TORNO_MEDICION_STATE,
  type TornoMedicionState,
} from "@/features/movimientos/crear/tornoMedicion.types";

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
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const [measuresModal, setMeasuresModal] = useState<MeasuresModalState>({
    open: false,
    loading: false,
    error: null,
    tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
  });

  const closeMeasuresModal = useCallback(() => {
    request.current?.abort();
    setMeasuresModal((prev) => ({ ...prev, open: false, error: null }));
  }, []);

  const openMeasuresModal = useCallback(
    async (args: OpenMeasuresModalArgs) => {
      const movementId = Number(args.movementId);
      if (!Number.isFinite(movementId) || movementId <= 0) return;

      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;

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
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`No se pudo cargar medidas (${response.status}).`);
        }

        const payload = await response.json();
        if (controller.signal.aborted) return;
        setMeasuresModal((prev) => ({
          ...prev,
          loading: false,
          tornoMedicion: parseTornoMedicionFromApi(payload),
          locomotiveLabel: String(
            payload?.movimiento?.locomotiveNumber ?? args.locomotiveLabel ?? "",
          ),
          companyName: payload?.movimiento?.empresa?.nombre ?? args.companyName,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "No se pudieron cargar las medidas.";
        setMeasuresModal((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [apiBase],
  );

  return { measuresModal, openMeasuresModal, closeMeasuresModal };
}
