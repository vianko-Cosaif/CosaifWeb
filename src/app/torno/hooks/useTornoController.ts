"use client";

import { useCallback } from "react";
import {
  cancelTornoService,
  concludeTornoService,
  finishTornoAxis,
  startTornoAxis,
  startTornoService,
  upsertTornoFinalMeasures,
} from "../lib/tornoService";
import type {
  TornoHistoryItem,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoMeasures,
  TornoNavajaChange,
  TornoReopenPayload,
  TornoResolvePayload,
  TornoWheelSide,
} from "../lib/types";

type NoticeType = "success" | "error" | "info";

type HistoryController = {
  detail: TornoHistoryItem | null;
  reload: () => Promise<void> | void;
  openDetail: (item: TornoHistoryItem) => Promise<void>;
};

type IncidentsController = {
  createParent: (payload: TornoIncidentPayload) => Promise<void>;
  editParent: (
    incident: TornoIncidentParent,
    patch: Partial<TornoIncidentPayload> & { status?: string },
  ) => Promise<void>;
  addChild: (parentId: string | number, payload: TornoIncidentPayload) => Promise<void>;
  resolveParent: (incident: TornoIncidentParent, payload?: TornoResolvePayload) => Promise<void>;
  reopenParent: (incident: TornoIncidentParent, payload?: TornoReopenPayload) => Promise<void>;
  resolveChild: (child: TornoIncidentChild, payload?: TornoResolvePayload) => Promise<void>;
};

type NavajasController = {
  createChange: (payload: {
    localidadId?: string | number;
    numeroNavaja?: string | number;
    creadoPorId?: string | number;
    fechaCambio?: string;
    comments?: string;
    images?: File[];
  }) => Promise<void>;
  items?: TornoNavajaChange[];
};

export function useTornoController({
  history,
  incidents,
  navajas,
  createdById,
  showNotice,
}: {
  history: HistoryController;
  incidents: IncidentsController;
  navajas: NavajasController;
  createdById?: string | number;
  showNotice: (type: NoticeType, message: string) => void;
}) {
  const refreshDetail = useCallback(async () => {
    await history.reload();
    if (history.detail) await history.openDetail(history.detail);
  }, [history]);

  const requireServiceId = useCallback((item: TornoHistoryItem) => {
    const id = item.rondaServicioId ?? item.id;
    if (!id) throw new Error("Servicio Torno sin rondaServicioId");
    return id;
  }, []);

  const requireActorId = useCallback(() => {
    if (!createdById) throw new Error("Usuario sin id para operar Torno");
    return createdById;
  }, [createdById]);

  const handleStartService = useCallback(
    async (item: TornoHistoryItem) => {
      try {
        await startTornoService(requireServiceId(item), {
          torneroId: requireActorId(),
          inicio: new Date().toISOString(),
        });
        await refreshDetail();
        showNotice("success", "Servicio iniciado");
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "No se pudo iniciar el servicio");
        throw error;
      }
    },
    [refreshDetail, requireActorId, requireServiceId, showNotice],
  );

  const handleCancelService = useCallback(
    async (item: TornoHistoryItem) => {
      if (!window.confirm("Cancelar este servicio de torno?")) return;
      try {
        await cancelTornoService(requireServiceId(item), { fin: new Date().toISOString() });
        await refreshDetail();
        showNotice("success", "Servicio cancelado");
      } catch (error) {
        showNotice("error", "No se pudo cancelar el servicio");
        throw error;
      }
    },
    [refreshDetail, requireServiceId, showNotice],
  );

  const handleStartWheel = useCallback(
    async (item: TornoHistoryItem, position: number, side: TornoWheelSide) => {
      try {
        await startTornoAxis(requireServiceId(item), position, {
          lados: [side],
          fechaInicio: new Date().toISOString(),
        });
        await refreshDetail();
      } catch (error) {
        showNotice("error", "No se pudo iniciar la rueda");
        throw error;
      }
    },
    [refreshDetail, requireServiceId, showNotice],
  );

  const handleFinishWheel = useCallback(
    async (item: TornoHistoryItem, position: number, side: TornoWheelSide) => {
      try {
        await finishTornoAxis(requireServiceId(item), position, {
          lados: [side],
          fechaFin: new Date().toISOString(),
        });
        await refreshDetail();
      } catch (error) {
        showNotice("error", "No se pudo finalizar la rueda");
        throw error;
      }
    },
    [refreshDetail, requireServiceId, showNotice],
  );

  const saveFinalMeasures = useCallback(
    async (item: TornoHistoryItem, measures: TornoMeasures) => {
      const ruedaSolicitudId = item.ruedaSolicitudId;
      if (!ruedaSolicitudId) throw new Error("El back no envio ruedaSolicitudId para guardar medidas finales");
      await upsertTornoFinalMeasures({
        ruedaSolicitudId,
        torneroId: requireActorId(),
        measures,
      });
      await refreshDetail();
      showNotice("success", "Medidas finales guardadas");
    },
    [refreshDetail, requireActorId, showNotice],
  );

  const concludeService = useCallback(
    async (item: TornoHistoryItem, measures: TornoMeasures) => {
      try {
        const ruedaSolicitudId = item.ruedaSolicitudId;
        if (!ruedaSolicitudId) throw new Error("El back no envio ruedaSolicitudId para concluir");
        const finalResult = await upsertTornoFinalMeasures({
          ruedaSolicitudId,
          torneroId: requireActorId(),
          measures,
        });
        await concludeTornoService(requireServiceId(item), {
          ruedasFinalId: readId(finalResult),
          fin: new Date().toISOString(),
        });
        await refreshDetail();
        showNotice("success", "Servicio concluido");
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "No se pudo concluir el servicio");
        throw error;
      }
    },
    [refreshDetail, requireActorId, requireServiceId, showNotice],
  );

  const createParent = useCallback(
    async (payload: TornoIncidentPayload) => {
      try {
        await incidents.createParent(payload);
        await refreshDetail();
        showNotice("success", "Incidente guardado");
      } catch (error) {
        showNotice("error", "No se pudo guardar el incidente");
        throw error;
      }
    },
    [incidents, refreshDetail, showNotice],
  );

  const editParent = useCallback(
    async (incident: TornoIncidentParent, patch: Partial<TornoIncidentPayload> & { status?: string }) => {
      try {
        await incidents.editParent(incident, { ...patch, atendidoPorId: createdById });
        await refreshDetail();
        showNotice("success", "Incidente actualizado");
      } catch (error) {
        showNotice("error", "No se pudo actualizar el incidente");
        throw error;
      }
    },
    [createdById, incidents, refreshDetail, showNotice],
  );

  const addChild = useCallback(
    async (parentId: string | number, payload: TornoIncidentPayload) => {
      try {
        await incidents.addChild(parentId, payload);
        await refreshDetail();
        showNotice("success", "Seguimiento guardado");
      } catch (error) {
        showNotice("error", "No se pudo guardar el seguimiento");
        throw error;
      }
    },
    [incidents, refreshDetail, showNotice],
  );

  const resolveParent = useCallback(
    async (incident: TornoIncidentParent, payload?: TornoResolvePayload) => {
      try {
        await incidents.resolveParent(incident, { ...payload, atendidoPorId: createdById });
        await refreshDetail();
        showNotice("success", "Incidente padre resuelto");
      } catch (error) {
        showNotice("error", "No se pudo resolver el incidente");
        throw error;
      }
    },
    [createdById, incidents, refreshDetail, showNotice],
  );

  const reopenParent = useCallback(
    async (incident: TornoIncidentParent, payload?: TornoReopenPayload) => {
      try {
        await incidents.reopenParent(incident, payload);
        await refreshDetail();
        showNotice("success", "Incidente reabierto");
      } catch (error) {
        showNotice("error", "No se pudo reabrir el incidente");
        throw error;
      }
    },
    [incidents, refreshDetail, showNotice],
  );

  const resolveChild = useCallback(
    async (child: TornoIncidentChild, payload?: TornoResolvePayload) => {
      try {
        await incidents.resolveChild(child, payload);
        await refreshDetail();
        showNotice("success", "Seguimiento resuelto");
      } catch (error) {
        showNotice("error", "No se pudo resolver el seguimiento");
        throw error;
      }
    },
    [incidents, refreshDetail, showNotice],
  );

  const createNavaja = useCallback(
    async (payload: {
      localidadId?: string | number;
      numeroNavaja?: string | number;
      fechaCambio?: string;
      comments?: string;
      images?: File[];
    }) => {
      try {
        await navajas.createChange({ ...payload, creadoPorId: createdById });
        showNotice("success", "Cambio de navajas registrado");
      } catch (error) {
        showNotice("error", "No se pudo registrar cambio de navajas");
        throw error;
      }
    },
    [createdById, navajas, showNotice],
  );

  return {
    refreshDetail,
    handleStartService,
    handleCancelService,
    handleStartWheel,
    handleFinishWheel,
    saveFinalMeasures,
    concludeService,
    createParent,
    editParent,
    addChild,
    resolveParent,
    reopenParent,
    resolveChild,
    createNavaja,
  };
}

function readId(input: unknown): string | number | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const data = source.data && typeof source.data === "object" ? source.data as Record<string, unknown> : null;
  const item = source.item && typeof source.item === "object" ? source.item as Record<string, unknown> : null;
  return firstScalarId(source.id) ?? firstScalarId(data?.id) ?? firstScalarId(item?.id);
}

function firstScalarId(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}
