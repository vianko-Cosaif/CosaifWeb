import { useCallback, useState } from "react";
import { Movimiento } from "../Movimiento";
import { API_BASE, roleBase, type MovementFormData, type Rol } from "../movimientos.shared";
import {
  buildMovimientoPayload,
  isPos,
  resolveTracksByMode,
} from "./crearMovimiento.domain";
import type { ResolvedIds, SelectionMode } from "./controller.types";
import type { TornoMedicionState } from "./tornoMedicion.types";

/**
 * MODULO: useCrearMovimientoSubmit
 *
 * Responsabilidad:
 * - Ejecutar el envio final del movimiento.
 * - Delegar armado de payload a funciones puras de dominio.
 * - Resolver fallback offline cuando falle conectividad.
 *
 * Este archivo NO:
 * - Renderiza UI.
 * - Carga catalogos.
 * - Administra estados visuales de steps.
 */

type CreateMovimientoResponse = {
  id?: number | string | null;
  movimientoId?: number | string | null;
  movimiento?: { id?: number | string | null } | null;
  data?: {
    id?: number | string | null;
    movimientoId?: number | string | null;
    movimiento?: { id?: number | string | null } | null;
  } | null;
};

function toPositiveInt(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function readMovementId(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const obj = raw as CreateMovimientoResponse;
  return (
    toPositiveInt(obj.id) ||
    toPositiveInt(obj.movimientoId) ||
    toPositiveInt(obj.movimiento?.id) ||
    toPositiveInt(obj.data?.id) ||
    toPositiveInt(obj.data?.movimientoId) ||
    toPositiveInt(obj.data?.movimiento?.id) ||
    0
  );
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Error al crear movimiento";
}

/**
 * Hook de envio final del wizard.
 *
 * Entrada:
 * - Estado del formulario + ids resueltos + callbacks externos.
 *
 * Salida:
 * - sending: bandera de request en curso.
 * - submit(): flujo completo de creacion/asignacion/redireccion.
 */
export function useCrearMovimientoSubmit(args: {
  form: MovementFormData;
  resolvedIds: ResolvedIds;
  selectionMode: SelectionMode;
  fromSection?: number;
  toSection?: number;
  rol: Rol;
  userId?: number;
  viaName: (id?: number | null) => string;
  tornoMedicion?: TornoMedicionState;
  companyName?: string;
  scheduledActivationId?: number | null;
  recoveredCancelledTornoId?: number | null;
  pushOutbox: (payload: unknown) => void;
  onSuccess: (ctx: { movimientoId: number; agendado?: boolean; activatedScheduled?: boolean }) => void;
  redirectOnSuccess?: boolean;
}) {
  const {
    form,
    resolvedIds,
    selectionMode,
    fromSection,
    toSection,
    rol,
    userId,
    viaName,
    tornoMedicion,
    companyName,
    scheduledActivationId,
    recoveredCancelledTornoId,
    pushOutbox,
    onSuccess,
    redirectOnSuccess = true,
  } = args;

  const [sending, setSending] = useState(false);

  const submit = useCallback(async () => {
    const { empresaId, creadoPorId, localidadId } = resolvedIds;

    const missing: string[] = [];
    if (!isPos(empresaId)) missing.push(`empresaId(${empresaId})`);
    if (!isPos(creadoPorId)) missing.push(`userId(${creadoPorId})`);
    if (!isPos(localidadId)) missing.push(`localidadId(${localidadId})`);
    if (missing.length > 0) {
      alert(`Faltan IDs requeridos: ${missing.join(", ")}. Cierra sesion y vuelve a entrar.`);
      return;
    }

    if (!form.locomotiveNumber.trim()) {
      alert("Falta numero de locomotora.");
      return;
    }

    const { fromTrack, toTrack } = resolveTracksByMode({
      service: form.service,
      selectionMode,
      fromTrack: form.fromTrack,
      toTrack: form.toTrack,
    });

    if (!fromTrack && !toTrack) {
      alert("Debe seleccionar al menos una via segun el modo de seleccion.");
      return;
    }

    let payloadForOffline: unknown = null;

    try {
      const {
        payload,
        viaParaAsignar,
        numeroParaAsignar,
      } = buildMovimientoPayload({
        resolvedIds,
        form,
        selectionMode,
        fromSection,
        toSection,
        userId,
        viaName,
        tornoMedicion,
        companyName,
        scheduledActivationId,
        recoveredCancelledTornoId,
      });
      payloadForOffline = payload;

      setSending(true);

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        pushOutbox(payload);
        setSending(false);
        return;
      }

      const res = await Movimiento.fetchWithTimeout(`${API_BASE}/movimientos`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...Movimiento.tokenHeader(),
        },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(txt);
          alert(j.message || j.error || txt);
        } catch {
          alert(txt || `HTTP ${res.status}`);
        }
        return;
      }

      const created = txt ? Movimiento.safeJSON(txt) : {};
      const movimientoId = readMovementId(created);
      const createdRecord = created as Record<string, any>;
      const wasScheduled = !!(createdRecord?.agendado || createdRecord?.data?.agendado);
      const activatedScheduled = !!(createdRecord?.activatedScheduled || createdRecord?.data?.activatedScheduled);

      if (movimientoId && viaParaAsignar && typeof numeroParaAsignar === "number") {
        await Movimiento.fetchWithTimeout(`${API_BASE}/secciones/via/${viaParaAsignar}/asignar`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...Movimiento.tokenHeader() },
          body: JSON.stringify({ numero: Number(numeroParaAsignar), movimientoId }),
        }).catch(() => { });
      }

      onSuccess({ movimientoId, agendado: wasScheduled, activatedScheduled });
      if (redirectOnSuccess && !wasScheduled) {
        window.location.assign(`${roleBase(rol)}/movimientos`);
      }
    } catch (e: unknown) {
      const msg = String((e instanceof Error ? e.name : "") || "").toLowerCase();
      const isAbort = msg.includes("abort");
      const isTypeErr = getErrorMessage(e).toLowerCase().includes("failed to fetch");

      if (isAbort || isTypeErr) {
        if (payloadForOffline !== null) pushOutbox(payloadForOffline);
        return;
      }

      alert(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  }, [
    resolvedIds,
    form,
    selectionMode,
    fromSection,
    toSection,
    userId,
    viaName,
    tornoMedicion,
    companyName,
    scheduledActivationId,
    recoveredCancelledTornoId,
    pushOutbox,
    onSuccess,
    rol,
    redirectOnSuccess,
  ]);

  return {
    sending,
    submit,
  };
}
