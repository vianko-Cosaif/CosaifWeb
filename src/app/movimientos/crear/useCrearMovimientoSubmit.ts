import { useCallback, useRef, useState } from "react";
import { Movimiento } from "../Movimiento";
import { API_BASE, roleBase, type MovementFormData, type Rol } from "../movimientos.shared";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import {
  buildMovimientoPayload,
  isPos,
  resolveTracksByMode,
} from "./crearMovimiento.domain";
import type { ResolvedIds, SelectionMode } from "./controller.types";
import type { TornoMedicionState } from "./tornoMedicion.types";
import { invalidateCachedJson } from "@/lib/clientRequestCache";

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

type TorreonIncidentProbe = {
  id?: number | string | null;
  motivo?: string | null;
  estado?: string | null;
  viaBloqueadaId?: number | null;
  seccionBloqueadaId?: number | null;
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

function isTorreonName(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .includes("torreon");
}

function isTorreonSelection(localidadId?: number | null, localityName?: string | null) {
  return isTorreonLocalidadId(localidadId) || isTorreonName(localityName);
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(typeof value === "number" && Number.isNaN(value))
    ))
  );
}

function optionalPositiveNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function buildClientRequestId(input: {
  localidadId?: number | null;
  userId?: number | string | null;
  locomotiveNumber?: string | null;
  fromTrack?: number | null;
  toTrack?: number | null;
  fromSection?: number;
  toSection?: number;
}) {
  const entropy = `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return [
    "web",
    "torreon",
    input.localidadId || "loc",
    input.userId || "user",
    String(input.locomotiveNumber || "").trim() || "loco",
    input.fromTrack || "from",
    input.fromSection ?? "fs",
    input.toTrack || "to",
    input.toSection ?? "ts",
    entropy,
  ].join(":");
}

function buildTorreonMovimientoPayload(args: {
  basePayload: Record<string, unknown>;
  fromTrack?: number | null;
  toTrack?: number | null;
  fromSection?: number;
  toSection?: number;
  viaName: (id?: number | null) => string;
  companyName?: string;
  localityName?: string;
}) {
  const { basePayload, fromTrack, toTrack, fromSection, toSection, viaName, companyName, localityName } = args;
  const tipoMovimiento = String(basePayload.tipoMovimiento || "");
  const prioridad = String(basePayload.prioridad || "BAJA");
  const direccionEmpuje = String(basePayload.direccionEmpuje || "Sin_Solicitar");
  const posicionCabina = String(basePayload.posicionCabina || "Sin_Solicitar");
  const posicionChimenea = String(basePayload.posicionChimenea || "Sin_Solicitar");

  return compactPayload({
    empresaId: optionalPositiveNumber(basePayload.empresaId),
    creadoPorId: optionalPositiveNumber(basePayload.creadoPorId),
    clienteId: optionalPositiveNumber(basePayload.clienteId),
    supervisorId: optionalPositiveNumber(basePayload.supervisorId),
    coordinadorId: optionalPositiveNumber(basePayload.coordinadorId),
    operadorId: optionalPositiveNumber(basePayload.operadorId),
    localidadId: optionalPositiveNumber(basePayload.localidadId),
    viaOrigenId: fromTrack ? Number(fromTrack) : undefined,
    viaDestinoId: toTrack ? Number(toTrack) : undefined,
    seccionOrigenId: typeof fromSection === "number" ? Number(fromSection) : undefined,
    seccionDestinoId: typeof toSection === "number" ? Number(toSection) : undefined,
    locomotiveNumber: optionalPositiveNumber(basePayload.locomotiveNumber),
    prioridad: prioridad === "ALTA" ? "ALTA" : "BAJA",
    tipoMovimiento: ["MD_TRABAJANDO", "REMOLCADA"].includes(tipoMovimiento) ? tipoMovimiento : undefined,
    instrucciones: basePayload.instrucciones,
    direccionEmpuje: ["EMPUJAR", "JALAR", "Sin_Solicitar"].includes(direccionEmpuje) ? direccionEmpuje : "Sin_Solicitar",
    posicionCabina: ["DENTRO", "AFUERA", "Sin_Solicitar"].includes(posicionCabina) ? posicionCabina : "Sin_Solicitar",
    posicionChimenea: ["DENTRO", "AFUERA", "Sin_Solicitar"].includes(posicionChimenea) ? posicionChimenea : "Sin_Solicitar",
    empresaNombreSnapshot: companyName,
    localidadNombreSnapshot: localityName,
    viaOrigenNombreSnapshot: fromTrack ? viaName(fromTrack) : undefined,
    viaDestinoNombreSnapshot: toTrack ? viaName(toTrack) : undefined,
    seccionOrigenNombreSnapshot: typeof fromSection === "number" ? `Seccion ${fromSection}` : undefined,
    seccionDestinoNombreSnapshot: typeof toSection === "number" ? `Seccion ${toSection}` : undefined,
  });
}

function asIncidentArray(raw: unknown): TorreonIncidentProbe[] {
  if (Array.isArray(raw)) return raw as TorreonIncidentProbe[];
  if (raw && typeof raw === "object") {
    const record = raw as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as TorreonIncidentProbe[];
    if (Array.isArray(record.items)) return record.items as TorreonIncidentProbe[];
    if (Array.isArray(record.rows)) return record.rows as TorreonIncidentProbe[];
  }
  return [];
}

function incidentMatchesTrack(
  incident: TorreonIncidentProbe,
  viaId?: number | null,
  section?: number | null
) {
  if (!viaId) return false;
  const incidentVia = Number(incident.viaBloqueadaId);
  const incidentSection = Number(incident.seccionBloqueadaId);
  if (Number.isFinite(incidentVia) && incidentVia !== Number(viaId)) return false;
  if (Number.isFinite(incidentSection) && section && incidentSection !== Number(section)) return false;
  return Number.isFinite(incidentVia) || Number.isFinite(incidentSection);
}

async function confirmTorreonOpenIncident(args: {
  localidadId: number;
  fromTrack?: number | null;
  toTrack?: number | null;
  fromSection?: number | null;
  toSection?: number | null;
  viaName: (id?: number | null) => string;
}) {
  const params = new URLSearchParams({
    source: "torreon",
    estado: "ABIERTO",
    localidadId: String(args.localidadId),
    page: "1",
    pageSize: "100",
  });

  const response = await fetch(`/api/incidentes?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return true;

  const incidents = asIncidentArray(await response.json());
  const match = incidents.find((incident) =>
    incidentMatchesTrack(incident, args.fromTrack, args.fromSection) ||
    incidentMatchesTrack(incident, args.toTrack, args.toSection)
  );
  if (!match) return true;

  const zonas = [
    args.fromTrack ? `origen ${args.viaName(args.fromTrack)}${args.fromSection ? ` seccion ${args.fromSection}` : ""}` : "",
    args.toTrack ? `destino ${args.viaName(args.toTrack)}${args.toSection ? ` seccion ${args.toSection}` : ""}` : "",
  ].filter(Boolean).join(" / ");
  const motivo = match.motivo ? `\n\nMotivo: ${match.motivo}` : "";

  return window.confirm(
    `Hay un incidente abierto que bloquea la ruta seleccionada (${zonas}).${motivo}\n\nSi confirmas, el movimiento se crea y queda en espera hasta que se resuelva el incidente.`
  );
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
  localityName?: string;
  scheduledActivationId?: number | null;
  recoveredCancelledTornoId?: number | null;
  pushOutbox: (payload: unknown, endpoint?: string) => void;
  onSuccess: (ctx: { movimientoId: number; agendado?: boolean; activatedScheduled?: boolean }) => void;
  redirectOnSuccess?: boolean;
  /** Bloqueo de defensa en profundidad para capacitación/sandbox. */
  disabled?: boolean;
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
    localityName,
    scheduledActivationId,
    recoveredCancelledTornoId,
    pushOutbox,
    onSuccess,
    redirectOnSuccess = true,
    disabled = false,
  } = args;

  const [sending, setSending] = useState(false);
  const inFlightRef = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const submit = useCallback(async () => {
    // Debe ser la primera condición: en sandbox no validamos, consultamos
    // incidentes, encolamos ni alcanzamos ninguno de los POST del flujo real.
    if (disabledRef.current || inFlightRef.current || sending) return;
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

    inFlightRef.current = true;
    let payloadForOffline: unknown = null;
    let endpointForOffline = `${API_BASE}/movimientos`;

    try {
      const isTorreon = isTorreonSelection(localidadId, localityName);

      if (isTorreon) {
        const confirmed = await confirmTorreonOpenIncident({
          localidadId,
          fromTrack,
          toTrack,
          fromSection,
          toSection,
          viaName,
        });
        if (!confirmed) return;
      }

      // El usuario puede iniciar/cerrar capacitación mientras una confirmación
      // está abierta. Revalidamos justo antes de construir/encolar/enviar.
      if (disabledRef.current) return;

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

      const requestPayload = isTorreon
        ? {
          ...buildTorreonMovimientoPayload({
          basePayload: payload,
          fromTrack,
          toTrack,
          fromSection,
          toSection,
          viaName,
          companyName,
          localityName,
          }),
          clientRequestId: buildClientRequestId({
            localidadId,
            userId,
            locomotiveNumber: form.locomotiveNumber,
            fromTrack,
            toTrack,
            fromSection,
            toSection,
          }),
        }
        : payload;
      const createEndpoint = isTorreon ? `${API_BASE}/torreon/movimientos` : `${API_BASE}/movimientos`;
      payloadForOffline = requestPayload;
      endpointForOffline = createEndpoint;

      setSending(true);

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (disabledRef.current) return;
        pushOutbox(requestPayload, createEndpoint);
        setSending(false);
        return;
      }

      if (disabledRef.current) return;

      const res = await Movimiento.fetchWithTimeout(createEndpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...Movimiento.tokenHeader(),
        },
        body: JSON.stringify(requestPayload),
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
      const createdRecord = created as {
        agendado?: unknown;
        activatedScheduled?: unknown;
        data?: { agendado?: unknown; activatedScheduled?: unknown } | null;
      };
      const wasScheduled = !!(createdRecord?.agendado || createdRecord?.data?.agendado);
      const activatedScheduled = !!(createdRecord?.activatedScheduled || createdRecord?.data?.activatedScheduled);

      if (!disabledRef.current && !isTorreon && movimientoId && viaParaAsignar && typeof numeroParaAsignar === "number") {
        await Movimiento.fetchWithTimeout(`${API_BASE}/secciones/via/${viaParaAsignar}/asignar`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...Movimiento.tokenHeader() },
          body: JSON.stringify({ numero: Number(numeroParaAsignar), movimientoId }),
        }).catch(() => { });
      }

      if (disabledRef.current) return;
      invalidateCachedJson("/movimientos");
      invalidateCachedJson("/api/cliente/rondas");
      onSuccess({ movimientoId, agendado: wasScheduled, activatedScheduled });
      if (redirectOnSuccess && !wasScheduled) {
        window.location.assign(`${roleBase(rol)}/movimientos`);
      }
    } catch (e: unknown) {
      const msg = String((e instanceof Error ? e.name : "") || "").toLowerCase();
      const isAbort = msg.includes("abort");
      const isTypeErr = getErrorMessage(e).toLowerCase().includes("failed to fetch");

      if (isAbort || isTypeErr) {
        if (!disabledRef.current && payloadForOffline !== null) pushOutbox(payloadForOffline, endpointForOffline);
        return;
      }

      alert(getErrorMessage(e));
    } finally {
      inFlightRef.current = false;
      setSending(false);
    }
  }, [
    sending,
    resolvedIds,
    form,
    selectionMode,
    fromSection,
    toSection,
    userId,
    viaName,
    tornoMedicion,
    companyName,
    localityName,
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
