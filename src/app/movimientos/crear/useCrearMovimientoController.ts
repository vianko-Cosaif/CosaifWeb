import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Movimiento } from "../Movimiento";
import { API_BASE, DOUBLE_TAP_MS, baseInitialForm, roleBase, type MovementFormData, type Seccion } from "../movimientos.shared";
import type { CrearMovimientoController, CrearMovimientoStep, LocomotoraBloqueada } from "./controller.types";
import { applyCatalogDefaults, resolveIds, validateStep1Data, validateStep2Data } from "./crearMovimiento.domain";
import { getRoleClient, readStoredUserClient, useCrearMovimientoSession } from "./useCrearMovimientoSession";
import { useCrearMovimientoCatalogos } from "./useCrearMovimientoCatalogos";
import { useCrearMovimientoDraft } from "./useCrearMovimientoDraft";
import { useCrearMovimientoOutbox } from "./useCrearMovimientoOutbox";
import { useCrearMovimientoSubmit } from "./useCrearMovimientoSubmit";
import {
  resolveTornoProfile,
  TORNO_PROFILE_FIELDS,
  TORNO_PROFILE_META,
} from "./tornoProfiles";
import { downloadTornoPdf } from "./tornoPdf";
import { parseTornoMedicionFromApi } from "../torno/tornoMeasureParser";
import type { ScheduledTornoMovement } from "./components/ScheduledTornoActivationModal";
import {
  DEFAULT_TORNO_MEDICION_STATE,
  EMPTY_TORNO_ROW,
  EMPTY_TORNO_VALUE,
  normalizeTornoMeasureValue,
  sanitizeTornoMeasurePart,
  type TornoMeasurementField,
  type TornoMeasurementPart,
  type TornoMedicionState,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "./tornoMedicion.types";

export type {
  CrearMovimientoStep,
  SelectionMode,
  LocomotoraBloqueada,
  UserSession,
  ResolvedIds,
} from "./controller.types";

type MovimientoLookup = { locomotiveNumber?: number | string | null };
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

function readLocomotiveNumber(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const obj = raw as MovimientoLookup;
  return Number(obj.locomotiveNumber ?? 0);
}

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

/**
 * Controlador declarativo del flujo "Crear Movimiento".
 * Compone sub-hooks especializados para mantener este archivo liviano.
 *
 * Arquitectura interna (orquestacion):
 * - Session hook: identidad, rol y bloqueos por permisos.
 * - Catalogos hook: empresas/localidades/vias/secciones.
 * - Draft hook: persistencia local de progreso.
 * - Outbox hook: resiliencia offline.
 * - Submit hook: envio final y redireccion.
 *
 * Regla de diseno:
 * - Este archivo coordina; no concentra reglas puras complejas.
 */
export function useCrearMovimientoController(): CrearMovimientoController {
  const [step, setStep] = useState<CrearMovimientoStep>(1);
  const [form, setForm] = useState<MovementFormData>(baseInitialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showFromOpts, setShowFromOpts] = useState(false);
  const [showToOpts, setShowToOpts] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"de_via" | "para_via">("de_via");
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);
  const [locoLockedBy, setLocoLockedBy] = useState<LocomotoraBloqueada | null>(null);
  const [tornoMedicion, setTornoMedicion] = useState<TornoMedicionState>(() => ({
    wheelCount: DEFAULT_TORNO_MEDICION_STATE.wheelCount,
    rows: {},
  }));
  const [tornoStep2Completed, setTornoStep2Completed] = useState(false);
  const [tornoMovimientoId, setTornoMovimientoId] = useState<number | null>(null);
  const [tornoPdfSending, setTornoPdfSending] = useState(false);
  const [tornoPdfStatus, setTornoPdfStatus] = useState<string | null>(null);
  const [activatingScheduledTorno, setActivatingScheduledTorno] = useState(false);
  const [scheduledActivationId, setScheduledActivationId] = useState<number | null>(null);
  const [recoveredCancelledTornoId, setRecoveredCancelledTornoId] = useState<number | null>(null);
  const [scheduledTornoMovements, setScheduledTornoMovements] = useState<ScheduledTornoMovement[]>([]);
  const [scheduledTornoLoading, setScheduledTornoLoading] = useState(false);
  const requestedScheduledTornoRef = useRef(false);
  const isService = !!form.service;
  const hasTornoPdfStep = form.service === "Torno" && selectionMode === "de_via";
  const maxStep: CrearMovimientoStep = hasTornoPdfStep ? 4 : 3;

  /** Capa 1: sesion/permisos. */
  const {
    rol,
    user,
    userCompanyName,
    canManageAll,
    adminRoles,
    initFormLocked,
    enforceLockedLocality,
  } = useCrearMovimientoSession(setForm);

  /** Capa 2: catalogos y datos operativos. */
  const {
    empresas,
    localidades,
    vias,
    sectionsByVia,
    secLoading,
    loadCatalogos,
    ensureSections,
  } = useCrearMovimientoCatalogos(form.selectedLocalityId);

  /** Capa 3: conectividad y cola offline. */
  const {
    online,
    pendingCount,
    banner,
    flushOutbox,
    pushOutbox,
    clearOutbox,
    hydratePendingCount,
  } = useCrearMovimientoOutbox();

  /** Capa 4: persistencia local del wizard. */
  const { hydrateDraft, clearDraft } = useCrearMovimientoDraft({
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
  });

  /**
   * Capa 5: normalizacion de IDs para operaciones de negocio.
   * Se evalua en memoria y no produce side effects.
   */
  const resolvedIds = useMemo(() => {
    const cookieEmp = Number(Movimiento.getCookie("empresaId") || NaN);
    const cookieLoc = Number(Movimiento.getCookie("locId") || NaN);
    const cookieUserId = Number(Movimiento.getCookie("userId") || NaN);

    return resolveIds({
      rol,
      adminRoles,
      form,
      user,
      cookieEmp,
      cookieLoc,
      cookieUserId,
    });
  }, [rol, adminRoles, form, user]);

  /**
   * Bootstrap del flujo:
   * 1) Aplica sesion bloqueada.
   * 2) Descarga catalogos.
   * 3) Aplica defaults de catalogo.
   * 4) Rehidrata draft y contador offline.
   */
  const didBootstrapRef = useRef(false);
  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    let alive = true;

    initFormLocked();

    (async () => {
      try {
        const { eList, lList } = await loadCatalogos();
        if (!alive) return;

        const role = getRoleClient();
        const userSnapshot = readStoredUserClient();
        const cookieEmp = Number(Movimiento.getCookie("empresaId") || NaN);

        setForm((prev) => applyCatalogDefaults({
          form: prev,
          user: userSnapshot,
          adminRoles,
          role,
          empresas: eList,
          localidades: lList,
          cookieEmp,
        }));
      } catch { }

      if (!alive) return;
      hydrateDraft();
      hydratePendingCount();
    })();

    return () => {
      alive = false;
    };
  }, [
    initFormLocked,
    loadCatalogos,
    hydrateDraft,
    hydratePendingCount,
    adminRoles,
  ]);

  /** Guarda de permisos: re-aplica localidad bloqueada cuando corresponde. */
  useEffect(() => {
    enforceLockedLocality();
  }, [enforceLockedLocality]);

  /** Regla UI: modo y vias deben permanecer consistentes cuando hay servicio. */
  useEffect(() => {
    if (!form.service) return;

    if (selectionMode === "de_via") {
      setForm((p) => ({ ...p, toTrack: null }));
      setToSection(undefined);
      setShowToOpts(false);
    } else {
      setForm((p) => ({ ...p, fromTrack: null }));
      setFromSection(undefined);
      setShowFromOpts(false);
    }
  }, [selectionMode, form.service]);

  /** Si el flujo deja de ser Torno+De via, invalida el paso PDF y su estado temporal. */
  useEffect(() => {
    if (hasTornoPdfStep) return;
    if (step === 4) setStep(3);
    setTornoStep2Completed(false);
    setTornoMovimientoId(null);
    setTornoPdfSending(false);
    setTornoPdfStatus(null);
  }, [hasTornoPdfStep, step]);

  /** Invalida seccion origen ante cambio de via origen. */
  useEffect(() => {
    setFromSection(undefined);
    if (form.fromTrack) ensureSections(form.fromTrack);
  }, [form.fromTrack, ensureSections]);

  /** Invalida seccion destino ante cambio de via destino. */
  useEffect(() => {
    setToSection(undefined);
    if (form.toTrack) ensureSections(form.toTrack);
  }, [form.toTrack, ensureSections]);

  const lastTap = useRef<Record<string, number>>({});
  const tapToggle = useCallback((key: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now();
    const last = lastTap.current[key] || 0;
    if (now - last < DOUBLE_TAP_MS) onDouble(); else onSingle();
    lastTap.current[key] = now;
  }, []);

  const viaName = useCallback(
    (id?: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || "" : ""),
    [vias]
  );
  const selectedCompanyName = useMemo(
    () => empresas.find((empresa) => empresa.id === form.empresaId)?.nombre || userCompanyName || "",
    [empresas, form.empresaId, userCompanyName]
  );
  const selectedLocalityName = useMemo(
    () => localidades.find((localidad) => localidad.id === form.selectedLocalityId)?.nombre || "",
    [localidades, form.selectedLocalityId]
  );

  const normalizeScheduledTornoList = useCallback((payload: unknown): ScheduledTornoMovement[] => {
    if (Array.isArray(payload)) return payload as ScheduledTornoMovement[];
    if (!payload || typeof payload !== "object") return [];
    const source = payload as Record<string, unknown>;
    const list = source.items ?? source.data ?? source.rows ?? source.results ?? [];
    return Array.isArray(list) ? (list as ScheduledTornoMovement[]) : [];
  }, []);

  const refreshScheduledTornoMovements = useCallback(async () => {
    try {
      setScheduledTornoLoading(true);
      const response = await Movimiento.fetchWithTimeout(`${API_BASE}/movimientos/torno/agendados`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json", ...Movimiento.tokenHeader() },
      });
      const text = await response.text();
      const data = text ? Movimiento.safeJSON(text) : {};
      if (!response.ok) throw new Error("No se pudieron cargar movimientos de torno agendados.");
      setScheduledTornoMovements(normalizeScheduledTornoList(data));
      requestedScheduledTornoRef.current = true;
    } catch {
      setScheduledTornoMovements([]);
      requestedScheduledTornoRef.current = false;
    } finally {
      setScheduledTornoLoading(false);
    }
  }, [normalizeScheduledTornoList]);

  useEffect(() => {
    if (form.service !== "Torno" || requestedScheduledTornoRef.current) return;
    void refreshScheduledTornoMovements();
  }, [form.service, refreshScheduledTornoMovements]);

  /**
   * Seleccion de seccion origen.
   * Si la seccion esta ocupada, intenta propagar locomotora para evitar inconsistencias.
   */
  const selectFromSection = useCallback(async (s: Seccion) => {
    const willSelect = fromSection !== s.numero;
    const newVal = willSelect ? s.numero : undefined;
    setFromSection(newVal);

    if (willSelect && s.ocupada && s.movimientoId) {
      const locoIn = Number(s.movimiento?.locomotiveNumber ?? 0);
      if (locoIn > 0) {
        setForm((p) => ({ ...p, locomotiveNumber: String(locoIn) }));
        setLocoLockedBy({ movimientoId: s.movimientoId, viaId: form.fromTrack!, numero: s.numero });
        return;
      }

      try {
        const mov = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${s.movimientoId}`);
        const loco = readLocomotiveNumber(mov);
        if (loco > 0) {
          setForm((p) => ({ ...p, locomotiveNumber: String(loco) }));
          setLocoLockedBy({ movimientoId: s.movimientoId, viaId: form.fromTrack!, numero: s.numero });
        }
      } catch { }
    } else {
      if (locoLockedBy && locoLockedBy.viaId === form.fromTrack && locoLockedBy.numero === s.numero) {
        setLocoLockedBy(null);
      }
    }
  }, [fromSection, form.fromTrack, locoLockedBy]);

  /** Valida step 1 delegando a dominio puro. */
  const validate1 = useCallback(() => {
    const next = validateStep1Data({
      canManageAll,
      resolvedIds,
      form,
      selectionMode,
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [canManageAll, resolvedIds, form, selectionMode]);

  /** Valida step 2 delegando a dominio puro. */
  const validate2 = useCallback(() => {
    const next = validateStep2Data({ form });
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  /** Ajusta cantidad de ruedas del Step Torno sin perder filas ya capturadas. */
  const setTornoWheelCount = useCallback((count: TornoWheelCount) => {
    setTornoMedicion((prev) => (prev.wheelCount === count ? prev : { ...prev, wheelCount: count }));
  }, []);

  /** Upsert tipado de una celda de medicion de ruedas (sanitizado local). */
  const updateTornoMedicion = useCallback(
    (
      position: TornoWheelPosition,
      field: TornoMeasurementField,
      part: TornoMeasurementPart,
      value: string
    ) => {
      const cleanPartValue = sanitizeTornoMeasurePart(part, value);

      setTornoMedicion((prev) => {
        const prevRow = prev.rows[position] ?? EMPTY_TORNO_ROW;
        const prevValue = prevRow[field] ?? EMPTY_TORNO_VALUE;
        const nextValue = normalizeTornoMeasureValue({
          ...prevValue,
          [part]: cleanPartValue,
        });
        if (
          prevValue.whole === nextValue.whole &&
          prevValue.num === nextValue.num &&
          prevValue.den === nextValue.den
        ) {
          return prev;
        }

        return {
          ...prev,
          rows: {
            ...prev.rows,
            [position]: {
              ...prevRow,
              [field]: nextValue,
            },
          },
        };
      });
    },
    []
  );

  /** Reinicia mediciones Torno en memoria local. */
  const clearTornoMedicion = useCallback(() => {
    setTornoMedicion({
      wheelCount: DEFAULT_TORNO_MEDICION_STATE.wheelCount,
      rows: {},
    });
  }, []);

  const activateScheduledTornoMovement = useCallback(async (scheduledMovement: ScheduledTornoMovement) => {
    const id = Number(scheduledMovement?.id);
    if (!Number.isInteger(id) || id <= 0 || activatingScheduledTorno) return;
    const isRecovery =
      scheduledMovement.temporaryRecovery === true ||
      scheduledMovement.recovery === true ||
      String(scheduledMovement.tipo ?? "").toUpperCase() === "TORNO_RECUPERACION";

    setActivatingScheduledTorno(true);
    try {
      const parsedMedicion = parseTornoMedicionFromApi({ medidasTorno: scheduledMovement.medidasTorno });

      const extractComments = (instr?: string | null) => {
        if (!instr) return "";
        // Quitamos los tags [META ...] y [TORNO_AGENDADO:...]
        let clean = instr.replace(/\[[A-Z0-9_]+:[^\]]*\]/g, "").trim();
        // Quitamos la parte descriptiva "De la via ... para la via ... | Posicion: ... |"
        // que agrega buildInstrucciones
        clean = clean.replace(/De la via.*?para la via.*?\|/g, "");
        clean = clean.replace(/De la via.*?\|/g, "");
        clean = clean.replace(/para la via.*?\|/g, "");
        clean = clean.replace(/Posicion:.*?\|/g, "");
        return clean.trim();
      };

      setForm((prev) => ({
        ...prev,
        empresaId: Number(scheduledMovement.empresaId) || prev.empresaId,
        selectedLocalityId: Number(scheduledMovement.localidadId) || prev.selectedLocalityId,
        fromTrack: Number(scheduledMovement.viaOrigenId) || prev.fromTrack,
        toTrack: Number(scheduledMovement.viaDestinoId) || prev.toTrack,
        service: "Torno",
        locomotiveNumber: String(scheduledMovement.locomotiveNumber ?? prev.locomotiveNumber ?? ""),
        movementType: (scheduledMovement.tipoMovimiento as any) || prev.movementType,
        priority: scheduledMovement.prioridad === "ALTA",
        direccionEmpuje: (scheduledMovement.direccionEmpuje as any) || prev.direccionEmpuje,
        pushPull: (scheduledMovement.direccionEmpuje as any) === "Sin_Solicitar" ? "" : (scheduledMovement.direccionEmpuje as any),
        cabinPosition: (scheduledMovement.posicionCabina as any) || prev.cabinPosition,
        chimneyPosition: (scheduledMovement.posicionChimenea as any) || prev.chimneyPosition,
        posicionChimenea: (scheduledMovement.posicionChimenea as any) || prev.posicionChimenea,
        polo: (scheduledMovement.polo as any) || prev.polo,
        comments: extractComments(scheduledMovement.instrucciones) || prev.comments,
        agendado: false,
        fechaProgramada: "",
      }));
      setSelectionMode("de_via");
      setTornoMedicion(parsedMedicion);
      setScheduledActivationId(isRecovery ? null : id);
      setRecoveredCancelledTornoId(isRecovery ? id : null);
      setTornoStep2Completed(false);
      setTornoMovimientoId(null);
      setTornoPdfStatus(
        isRecovery
          ? "Medidas recuperadas. Revisa la informacion y confirma para crear un movimiento nuevo."
          : "Solicitud agendada precargada. Revisa las medidas y confirma para activarla."
      );
      setStep(2);
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo precargar el movimiento agendado.");
      setTornoPdfStatus(null);
    } finally {
      setActivatingScheduledTorno(false);
    }
  }, [activatingScheduledTorno]);

  /** Limpieza post-submit exitoso (estado temporal del wizard). */
  const onSubmitSuccess = useCallback(
    ({ movimientoId, agendado, activatedScheduled }: { movimientoId: number; agendado?: boolean; activatedScheduled?: boolean }) => {
      if (agendado) {
        alert("Movimiento de torno agendado correctamente.");
        clearDraft();
        setFromSection(undefined);
        setToSection(undefined);
        setLocoLockedBy(null);
        clearTornoMedicion();
        setTornoStep2Completed(false);
        setTornoMovimientoId(null);
        setTornoPdfStatus(null);
        setTornoPdfSending(false);
        setScheduledActivationId(null);
        setRecoveredCancelledTornoId(null);
        const consumedId = scheduledActivationId ?? recoveredCancelledTornoId;
        setScheduledTornoMovements((prev) => prev.filter((item) => Number(item.id) !== Number(consumedId)));
        requestedScheduledTornoRef.current = true;
        setStep(1);
        window.location.assign(`${roleBase(rol)}/movimientos`);
        return;
      }

      if (hasTornoPdfStep) {
        if (activatedScheduled) {
          alert("La solicitud agendada de torno fue activada y colocada en ronda.");
          const consumedId = scheduledActivationId ?? recoveredCancelledTornoId;
          setScheduledTornoMovements((prev) => prev.filter((item) => Number(item.id) !== Number(consumedId)));
          requestedScheduledTornoRef.current = true;
          setScheduledActivationId(null);
          setRecoveredCancelledTornoId(null);
        } else if (recoveredCancelledTornoId) {
          alert("Las medidas recuperadas se usaron para crear un movimiento nuevo.");
          setScheduledTornoMovements((prev) => prev.filter((item) => Number(item.id) !== Number(recoveredCancelledTornoId)));
          requestedScheduledTornoRef.current = true;
          setRecoveredCancelledTornoId(null);
        }
        setTornoStep2Completed(true);
        setTornoMovimientoId(Number.isFinite(movimientoId) && movimientoId > 0 ? movimientoId : 0);
        setTornoPdfStatus(null);
        setStep(4);
        return;
      }

      clearDraft();
      setFromSection(undefined);
      setToSection(undefined);
      setLocoLockedBy(null);
      clearTornoMedicion();
      setTornoStep2Completed(false);
      setTornoMovimientoId(null);
      setTornoPdfStatus(null);
      setTornoPdfSending(false);
      setScheduledActivationId(null);
      setRecoveredCancelledTornoId(null);
      setStep(1);
    },
    [clearDraft, clearTornoMedicion, hasTornoPdfStep, recoveredCancelledTornoId, rol, scheduledActivationId]
  );

  /** Capa 6: envio final. */
  const { sending, submit } = useCrearMovimientoSubmit({
    form,
    resolvedIds,
    selectionMode,
    fromSection,
    toSection,
    rol,
    userId: user?.id,
    viaName,
    tornoMedicion,
    companyName: selectedCompanyName,
    localityName: selectedLocalityName,
    scheduledActivationId,
    recoveredCancelledTornoId,
    pushOutbox,
    onSuccess: onSubmitSuccess,
    redirectOnSuccess: !hasTornoPdfStep,
  });

  /** Submit de Step 3: evita recrear movimiento si ya existe en flujo Torno+PDF. */
  const submitStepThree = useCallback(async () => {
    if (hasTornoPdfStep && tornoMovimientoId !== null) {
      setStep(4);
      return;
    }
    await submit();
  }, [hasTornoPdfStep, tornoMovimientoId, submit]);

  const label = hasTornoPdfStep
    ? (["Paso 1 de 4", "Paso 2 de 4", "Paso 3 de 4", "Paso 4 de 4"] as const)[step - 1]
    : (["Paso 1 de 3", "Paso 2 de 3", "Paso 3 de 3"] as const)[Math.min(step, 3) - 1];

  const lockedClienteMissingData = !canManageAll && !Number.isFinite(Number(Movimiento.getCookie("locId") || NaN));

  /** Shortcut de envio en step final. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter" && step === 3 && !sending) {
        e.preventDefault();
        submitStepThree();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, sending, submitStepThree]);

  const goSalir = useCallback(() => {
    window.location.assign(`${roleBase(rol)}/movimientos`);
  }, [rol]);

  const goPrev = useCallback(() => {
    setStep((s) => (s === 1 ? 1 : ((s - 1) as CrearMovimientoStep)));
  }, []);

  const goNext = useCallback(() => {
    if (step >= maxStep) return;
    if (step === 1 && !validate1()) return;
    if (step === 2 && !validate2()) return;
    if (hasTornoPdfStep && step === 2) {
      setTornoStep2Completed(true);
      if (tornoMovimientoId !== null) {
        setStep(4);
        return;
      }
    }
    setStep((s) => {
      const next = (s + 1) as CrearMovimientoStep;
      return next > maxStep ? maxStep : next;
    });
  }, [step, validate1, validate2, maxStep, hasTornoPdfStep, tornoMovimientoId]);

  const goBackToTornoMedicion = useCallback(() => {
    if (!hasTornoPdfStep) return;
    setStep(2);
    setTornoPdfStatus(null);
  }, [hasTornoPdfStep]);

  const generateTornoPdf = useCallback(async () => {
    if (!hasTornoPdfStep || tornoPdfSending) return;
    setTornoPdfSending(true);
    setTornoPdfStatus("Generando PDF...");

    try {
      const profile = resolveTornoProfile(selectedCompanyName);
      const fileName = downloadTornoPdf({
        locomotiveNumber: form.locomotiveNumber,
        movimientoId: tornoMovimientoId,
        comments: form.comments || "",
        tornoMedicion,
        columns: TORNO_PROFILE_FIELDS[profile],
        profileTitle: TORNO_PROFILE_META[profile].title,
      });
      setTornoPdfStatus(`PDF generado: ${fileName}`);
    } catch {
      setTornoPdfStatus("No se pudo generar el PDF. Intenta nuevamente.");
    } finally {
      setTornoPdfSending(false);
    }
  }, [hasTornoPdfStep, tornoPdfSending, selectedCompanyName, form.locomotiveNumber, form.comments, tornoMovimientoId, tornoMedicion]);

  const clearForm = useCallback(() => {
    clearDraft();
    setForm((prev) => ({ ...baseInitialForm, selectedLocalityId: canManageAll ? null : prev.selectedLocalityId }));
    setFromSection(undefined);
    setToSection(undefined);
    clearTornoMedicion();
    setTornoStep2Completed(false);
    setTornoMovimientoId(null);
    setTornoPdfSending(false);
    setTornoPdfStatus(null);
    setActivatingScheduledTorno(false);
    setScheduledActivationId(null);
    setRecoveredCancelledTornoId(null);
    setScheduledTornoMovements([]);
    setScheduledTornoLoading(false);
    requestedScheduledTornoRef.current = false;
    setErrors({});
    setShowFromOpts(false);
    setShowToOpts(false);
    if (step >= 3) setStep(1);
  }, [canManageAll, clearDraft, step, clearTornoMedicion]);

  return {
    step,
    setStep,
    form,
    setForm,
    sending,
    errors,
    banner,
    empresas,
    localidades,
    vias,
    sectionsByVia,
    secLoading,
    rol,
    canManageAll,
    userCompanyName,
    showFromOpts,
    setShowFromOpts,
    showToOpts,
    setShowToOpts,
    selectionMode,
    setSelectionMode,
    fromSection,
    setToSection,
    toSection,
    locoLockedBy,
    setLocoLockedBy,
    tornoMedicion,
    setTornoWheelCount,
    updateTornoMedicion,
    clearTornoMedicion,
    hasTornoPdfStep,
    tornoStep2Completed,
    tornoMovimientoId,
    tornoPdfSending,
    tornoPdfStatus,
    generateTornoPdf,
    goBackToTornoMedicion,
    activateScheduledTornoMovement,
    scheduledTornoMovements,
    scheduledTornoLoading,
    refreshScheduledTornoMovements,
    online,
    pendingCount,
    flushOutbox,
    submit: submitStepThree,
    validate1,
    validate2,
    tapToggle,
    ensureSections,
    selectFromSection,
    viaName,
    isService,
    label,
    lockedClienteMissingData,
    goSalir,
    goPrev,
    goNext,
    clearForm,
    clearOutbox,
  };
}
