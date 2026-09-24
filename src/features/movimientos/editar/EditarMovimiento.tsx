"use client";

import React, { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Movimiento } from "@/features/movimientos/Movimiento";
import { GuidedTarget } from "@/features/capacitacion";
import { TRAINING_CREATED_MOVEMENT_ID, TRAINING_MOVEMENT_ID, TRAINING_PAST_MOVEMENT_ID, useTrainingTour } from "@/features/capacitacion/TrainingTourContext";
import type { Movement } from "@/features/movimientos/list/useMovimientos";
import { API_BASE, SECC_BASE, DOUBLE_TAP_MS, Direccion, Posicion, Servicio, Rol, Polo, Via, Seccion, InfoEdicion, EditablePayload, MovementFormData, baseInitialForm } from "@/features/movimientos/movimientos.shared";
import TornoMeasuresViewerModal from "@/features/movimientos/torno/TornoMeasuresViewerModal";
import { parseTornoMedicionFromApi } from "@/features/movimientos/torno/tornoMeasureParser";
import { buildBackendTornoMedidas } from "@/features/movimientos/crear/tornoSubmit.adapter";
import StepTwoTorno from "@/features/movimientos/crear/components/StepTwoTorno";
import MobileGuidedTornoMeasuresStep, { getGuidedTornoMeasuresPageCount, getGuidedTornoMeasuresPageTitle } from "@/features/movimientos/crear/components/MobileGuidedTornoMeasuresStep";
import { createEmptyTornoRow, DEFAULT_TORNO_MEDICION_STATE, EMPTY_TORNO_VALUE, normalizeTornoMeasureValue, sanitizeTornoMeasurePart, type TornoMeasurementField, type TornoMeasurementPart, type TornoMedicionState, type TornoWheelCount, type TornoWheelPosition } from "@/features/movimientos/crear/tornoMedicion.types";
import { buildTrainingEditInfo, TRAINING_EDIT_VIAS, trainingPosition, trainingDirection, TRAINING_EDIT_SECTIONS } from "./training";
import { Badge, RoleBadge, Step1Edit, Step2Edit, Step3Edit } from "./components/EditSteps";
import { isTornoModuleEnabled } from "@/lib/tornoFeature";

export const serializeTornoMedicion = (value: TornoMedicionState) => JSON.stringify(value);

export default function EditarMovimiento({
  movimientoId,
  onClose,
  onSaved,
  initialRole,
}: {
  movimientoId: number | string;
  initialRole?: string;
  onClose?: () => void;
  onSaved?: (updated: unknown) => void;
}) {
  const router = useRouter();
  const training = useTrainingTour();
  const numericMovementId = Number(movimientoId);
  const reservedTrainingId = [
    TRAINING_MOVEMENT_ID,
    TRAINING_PAST_MOVEMENT_ID,
    TRAINING_CREATED_MOVEMENT_ID,
  ].includes(numericMovementId);
  const trainingMovement = training.getMovement(movimientoId);
  const isTrainingEditor = training.active
    || reservedTrainingId
    || training.isTrainingMovement(movimientoId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTrainingSaveConfirmation, setShowTrainingSaveConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<"de_via" | "para_via">("de_via");
  const [serviceVia, setServiceVia] = useState<Servicio | undefined>("");
  const [info, setInfo] = useState<InfoEdicion | null>(null);
  const [vias, setVias] = useState<Via[]>([]);
  const [sectionsByVia, setSectionsByVia] = useState<Record<number, Seccion[]>>({});
  const [secLoading, setSecLoading] = useState<Record<number, boolean>>({});

  // Form local (solo editables)
  const [instrucciones, setInstrucciones] = useState<string>("");
  const [locomotiveNumber, setLocomotiveNumber] = useState<string>("");
  const [viaOrigenId, setViaOrigenId] = useState<number | null>(null);
  const [viaDestinoId, setViaDestinoId] = useState<number | null>(null);
  const [tipoMovimiento, setTipoMovimiento] = useState<"MD_TRABAJANDO" | "REMOLCADA" | "">("");
  const [posicionCabina, setPosicionCabina] = useState<Posicion>("Sin_Solicitar");
  const [posicionChimenea, setPosicionChimenea] = useState<Posicion>("Sin_Solicitar");
  const [direccionEmpuje, setDireccionEmpuje] = useState<Direccion>("Sin_Solicitar");
  const [polo, setPolo] = useState<Polo>("Sin_Solicitar");
  const [form, setForm] = useState<MovementFormData>(baseInitialForm);
  const [tornoMedicion, setTornoMedicion] = useState<TornoMedicionState>(() => ({
    wheelCount: DEFAULT_TORNO_MEDICION_STATE.wheelCount,
    rows: {},
  }));
  const [initialTornoMedicion, setInitialTornoMedicion] = useState<TornoMedicionState>(
    DEFAULT_TORNO_MEDICION_STATE
  );
  const [initialTornoSerialized, setInitialTornoSerialized] = useState<string>(
    serializeTornoMedicion(DEFAULT_TORNO_MEDICION_STATE)
  );
  const [showTornoViewerModal, setShowTornoViewerModal] = useState(false);
  const [editFlowMode, setEditFlowMode] = useState<"mobile" | "classic">("mobile");
  const [tornoEditMode, setTornoEditMode] = useState<"mobile" | "classic">("mobile");
  const [mobileStepOnePage, setMobileStepOnePage] = useState(0);
  const [mobileTornoPage, setMobileTornoPage] = useState(0);
  const lastTap = useRef<Record<string, number>>({});
  const saveLockRef = useRef(false);

  // Secciones elegidas para hint META (el backend solo las lee desde instrucciones)
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);

  // Estado para el flujo de pasos
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const STEP_CFG = [
    { label: "Paso 1 de 3", percent: 33 },
    { label: "Paso 2 de 3", percent: 66 },
    { label: "Paso 3 de 3", percent: 100 },
  ] as const;
  const { label, percent } = STEP_CFG[step - 1];
  const mobileStepOneSections = ["context", "service", "locomotive", "route"] as const;
  const mobileStepOneTitles = ["Empresa y localidad", "Servicio", "Locomotora", "Via y seccion"];
  const mobileStepOneSection = mobileStepOneSections[mobileStepOnePage] ?? "context";

  // Preserve existing instructions when reviewing the edit.

  useEffect(() => {
    if (serviceVia !== "Torno") {
      setMobileTornoPage(0);
    }
  }, [serviceVia]);

  useEffect(() => {
    if (editFlowMode !== "mobile" || step !== 1) {
      setMobileStepOnePage(0);
    }
  }, [editFlowMode, step]);

  // Rol y helpers
  const [rol, setRol] = useState<Rol>((initialRole || "CLIENTE") as Rol);
  useEffect(() => { const r = String(Movimiento.getCookie("role") || "").toUpperCase() as Rol; if (r) setRol(r); }, []);
  const canManageAll = ["ADMINISTRADOR", "COORDINADOR"].includes(rol);
  const roleToPath = (r?: string) => {
    const R = String(r || "").toUpperCase();
    if (R === "COORDINADOR") return "/coordinador/movimientos";
    if (R === "ADMINISTRADOR") return "/administrador/movimientos";
    if (R === "SUPERVISOR") return "/supervisor/movimientos";
    return "/cliente/movimientos";
  };
  const closeEditor = onClose || (isTrainingEditor
    ? () => router.push(`${training.roleBase}/movimientos`)
    : () => window.location.assign(roleToPath(rol)));

  /** Cargar info edición + vías */
  useEffect(() => {
    let mounted = true;

    if (isTrainingEditor) {
      setLoading(true);
      setError(null);
      if (!trainingMovement) {
        // El provider puede estar restaurando sessionStorage. Nunca intentamos
        // resolver un ID SIM contra el backend mientras eso ocurre.
        setInfo(null);
        setLoading(false);
        setError("El movimiento SIM ya no está disponible. Reinicia la capacitación para volver a crearlo.");
        return () => { mounted = false; };
      }

      const data = buildTrainingEditInfo(trainingMovement);
      const origin = data.movimiento.viaOrigen ?? TRAINING_EDIT_VIAS[1];
      const destination = data.movimiento.viaDestino ?? TRAINING_EDIT_VIAS[3];
      const initialMeasures: TornoMedicionState = {
        wheelCount: DEFAULT_TORNO_MEDICION_STATE.wheelCount,
        rows: {},
      };

      setInfo(data);
      setInstrucciones(String(trainingMovement.instrucciones ?? ""));
      setLocomotiveNumber(String(trainingMovement.locomotora ?? ""));
      setViaOrigenId(origin.id);
      setViaDestinoId(destination.id);
      setTipoMovimiento(trainingMovement.tipoMovimiento === "REMOLCADA" ? "REMOLCADA" : "MD_TRABAJANDO");
      setPolo("Sin_Solicitar");
      setPosicionCabina(trainingPosition(trainingMovement.posicionCabina));
      setPosicionChimenea(trainingPosition(trainingMovement.posicionChimenea));
      setDireccionEmpuje(trainingDirection(trainingMovement.direccionEmpuje));
      setServiceVia(trainingMovement.torno ? "Torno" : trainingMovement.lavado ? "Lavado" : "");
      setForm({
        ...baseInitialForm,
        empresaId: trainingMovement.empresaId,
        selectedLocalityId: trainingMovement.localidadId,
        locomotiveNumber: String(trainingMovement.locomotora ?? ""),
        priority: trainingMovement.prioridad === "ALTA",
        fromTrack: origin.id,
        toTrack: destination.id,
        movementType: trainingMovement.tipoMovimiento === "REMOLCADA" ? "REMOLCADA" : "MD_TRABAJANDO",
        comments: trainingMovement.instrucciones,
        service: trainingMovement.torno ? "Torno" : trainingMovement.lavado ? "Lavado" : "",
      });
      setVias(TRAINING_EDIT_VIAS);
      setSectionsByVia(TRAINING_EDIT_SECTIONS);
      setFromSection(1);
      setToSection(2);
      setTornoMedicion(initialMeasures);
      setInitialTornoMedicion(initialMeasures);
      setInitialTornoSerialized(serializeTornoMedicion(initialMeasures));
      setEditFlowMode("classic");
      setTornoEditMode("classic");
      setStep(1);
      setLoading(false);
      return () => { mounted = false; };
    }

    (async () => {
      try {
        setLoading(true);
        const data = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`) as InfoEdicion;
        if (!mounted) return;
        setInfo(data);

        // Prefill
        setInstrucciones(String(data.movimiento.instrucciones ?? ""));
        setLocomotiveNumber(String(data.movimiento.locomotiveNumber ?? ""));
        setViaOrigenId(data.movimiento.viaOrigen?.id ?? null);
        setViaDestinoId(data.movimiento.viaDestino?.id ?? null);
        setTipoMovimiento(data.movimiento.tipoMovimiento || "");
        setPolo(data.movimiento.polo || "Sin_Solicitar");
        setPosicionCabina(data.movimiento.posicionCabina ?? "Sin_Solicitar");
        setPosicionChimenea(data.movimiento.posicionChimenea ?? "Sin_Solicitar");
        setDireccionEmpuje(data.movimiento.direccionEmpuje ?? "Sin_Solicitar");
        const movementServiceFlags = data.movimiento as typeof data.movimiento & { lavado?: boolean };
        setServiceVia(movementServiceFlags.lavado || data.movimiento.Lavado ? "Lavado" : data.movimiento.torno ? "Torno" : "");
        const parsedTorno = parseTornoMedicionFromApi(data);
        setTornoMedicion(parsedTorno);
        setInitialTornoMedicion(parsedTorno);
        setInitialTornoSerialized(serializeTornoMedicion(parsedTorno));

        // Prefill secciones desde meta si aplica (el parser expone meta.seccion y meta.destinoId)
        if (data.movimiento.meta?.seccion) setToSection(Number(data.movimiento.meta.seccion));

        // Cargar vías por localidad
        const locId = data.movimiento.localidad?.id;
        if (locId) {
          const list = await Movimiento.fetchJSON(`${API_BASE}/vias/localidad/${locId}`).catch(() => []);
          const vList: Via[] = Array.isArray(list)
            ? list.map((v: Via) => ({
                id: v.id,
                nombre: v.nombre,
                lineaDeVida: v.lineaDeVida ?? null,
              }))
            : [];
          vList.sort((a, b) => {
            const numA = Number(a.nombre);
            const numB = Number(b.nombre);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (!isNaN(numA)) return -1;
            if (!isNaN(numB)) return 1;
            return String(a.nombre).localeCompare(String(b.nombre));
          });
          setVias(vList);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar la información de edición.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isTrainingEditor, movimientoId, trainingMovement]);

  /** Secciones por vía (caché) */
  const secLoadingRef = useRef<Record<number, boolean>>({});
  const ensureSections = useCallback(async (viaId: number) => {
    if (!viaId) return;
    if (isTrainingEditor) {
      setSectionsByVia((current) => ({
        ...current,
        [viaId]: current[viaId] ?? TRAINING_EDIT_SECTIONS[viaId] ?? [],
      }));
      return;
    }
    if (secLoadingRef.current[viaId]) return;
    if (Array.isArray(sectionsByVia[viaId])) return;

    secLoadingRef.current[viaId] = true;
    setSecLoading((s) => ({ ...s, [viaId]: true }));
    try {
      const raw = await Movimiento.fetchJSON(`${SECC_BASE}/via/${viaId}`);
      const arr: Seccion[] = Array.isArray(raw) ? raw : raw?.secciones ?? [];
      const ordered = arr.slice().sort((a, b) => a.numero - b.numero);
      setSectionsByVia((m) => ({ ...m, [viaId]: ordered }));
    } catch {
      setSectionsByVia((m) => ({ ...m, [viaId]: [] }));
    } finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [isTrainingEditor, sectionsByVia]);

  /** UI helpers */
  const viaName = useCallback(
    (id?: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || "" : ""),
    [vias]
  );
  useEffect(() => { if (viaOrigenId) ensureSections(viaOrigenId); }, [viaOrigenId, ensureSections]);
  useEffect(() => { if (viaDestinoId) ensureSections(viaDestinoId); }, [viaDestinoId, ensureSections]);

  /** Validaciones ligeras */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validateStep2 = useCallback(() => {
    const e: Record<string, string> = {};
    if (!tipoMovimiento) e.tipoMovimiento = "Selecciona el tipo de movimiento.";
    if (tipoMovimiento === "REMOLCADA" && !["EMPUJAR", "JALAR"].includes(direccionEmpuje)) {
      e.direccionEmpuje = "Selecciona EMPUJAR o JALAR.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [tipoMovimiento, direccionEmpuje]);

  /** Construir descripción automática de vías, secciones y polo igual que en CrearMovimiento */
  const buildAutoDescription = (fromTrackId?: number | null, toTrackId?: number | null, fromSection?: number, toSection?: number, polo?: "NORTE" | "SUR" | "Sin_Solicitar"): string => {
    const partes: string[] = [];
    if (fromTrackId)
      partes.push(`De la vía ${viaName(fromTrackId)}${typeof fromSection === "number" ? ` (sección ${fromSection})` : ""}`);
    if (toTrackId)
      partes.push(`para la vía ${viaName(toTrackId)}${typeof toSection === "number" ? ` (sección ${toSection})` : ""}`);

    // Add polo information if selected
    if (polo && polo !== "Sin_Solicitar") {
      partes.push(`| Posición: ${polo} |`);
    }

    return partes.join(" ");
  };
  const tapToggle = (key: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now();
    const last = lastTap.current[key] || 0;
    if (now - last < DOUBLE_TAP_MS) onDouble(); else onSingle();
    lastTap.current[key] = now;
  };
  const setTornoWheelCount = useCallback((count: TornoWheelCount) => {
    setTornoMedicion((prev) => (prev.wheelCount === count ? prev : { ...prev, wheelCount: count }));
  }, []);

  const updateTornoMedicion = useCallback(
    (
      position: TornoWheelPosition,
      field: TornoMeasurementField,
      part: TornoMeasurementPart,
      value: string
    ) => {
      const cleanPartValue = sanitizeTornoMeasurePart(part, value);
      setTornoMedicion((prev) => {
        const prevRow = prev.rows[position] ?? createEmptyTornoRow();
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

  const tornoStepForm = useMemo<MovementFormData>(() => ({
    ...baseInitialForm,
    locomotiveNumber,
    movementType: tipoMovimiento,
    direccionEmpuje,
    pushPull: direccionEmpuje === "EMPUJAR" || direccionEmpuje === "JALAR" ? direccionEmpuje : "",
  }), [locomotiveNumber, tipoMovimiento, direccionEmpuje]);

  const setTornoStepForm = useCallback(
    (next: React.SetStateAction<MovementFormData>) => {
      const resolved = typeof next === "function" ? next(tornoStepForm) : next;
      if (resolved.movementType !== undefined) {
        setTipoMovimiento((resolved.movementType as "MD_TRABAJANDO" | "REMOLCADA" | "") || "");
      }
      if (resolved.direccionEmpuje !== undefined) {
        setDireccionEmpuje((resolved.direccionEmpuje as Direccion) || "Sin_Solicitar");
      } else if (resolved.pushPull === "EMPUJAR" || resolved.pushPull === "JALAR") {
        setDireccionEmpuje(resolved.pushPull);
      }
    },
    [tornoStepForm]
  );

  const tornoMobilePageCount = getGuidedTornoMeasuresPageCount();
  const isMobileEditFlow = editFlowMode === "mobile";
  const isMobileTornoEditor = isTornoModuleEnabled && serviceVia === "Torno" && isMobileEditFlow && tornoEditMode === "mobile";
  const tornoEditorSubtitle = isMobileTornoEditor
    ? getGuidedTornoMeasuresPageTitle(mobileTornoPage, tornoMedicion.wheelCount)
    : "Diagnostico torno";
  const mobileTotalUnits = isTornoModuleEnabled && serviceVia === "Torno" ? 7 : 6;
  const mobileCurrentUnit =
    step === 1
      ? mobileStepOnePage + 1
      : step === 2 && isTornoModuleEnabled && serviceVia === "Torno"
        ? 4 + mobileTornoPage + 1
        : step === 2
          ? 5
          : mobileTotalUnits;
  const mobileProgress = isMobileEditFlow
    ? Math.round((mobileCurrentUnit / mobileTotalUnits) * 100)
    : percent;
  const mobileStepTitle = isMobileEditFlow
    ? step === 1
      ? mobileStepOneTitles[mobileStepOnePage] ?? "Datos"
      : step === 2 && isTornoModuleEnabled && serviceVia === "Torno"
        ? getGuidedTornoMeasuresPageTitle(mobileTornoPage, tornoMedicion.wheelCount)
        : step === 2
          ? "Detalles operativos"
          : "Confirmacion"
    : label;
  const mobileTransitionKey = `${editFlowMode}:${step}:${mobileStepOnePage}:${mobileTornoPage}:${serviceVia || "none"}`;

  const goPreviousStep = () => {
    if (isMobileEditFlow && step === 1 && mobileStepOnePage > 0) {
      setMobileStepOnePage((page) => Math.max(0, page - 1));
      return;
    }
    if (step === 2 && isMobileTornoEditor && mobileTornoPage > 0) {
      setMobileTornoPage((page) => Math.max(0, page - 1));
      return;
    }
    if (isMobileEditFlow && step === 2) {
      setMobileStepOnePage(mobileStepOneSections.length - 1);
    }
    if (isMobileEditFlow && step === 3 && isTornoModuleEnabled && serviceVia === "Torno") {
      setMobileTornoPage(Math.max(0, tornoMobilePageCount - 1));
    }
    setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)));
  };

  const goNextStep = () => {
    if (isMobileEditFlow && step === 1 && mobileStepOnePage < mobileStepOneSections.length - 1) {
      setMobileStepOnePage((page) => Math.min(mobileStepOneSections.length - 1, page + 1));
      return;
    }
    if (step === 2 && isMobileTornoEditor && mobileTornoPage < tornoMobilePageCount - 1) {
      setMobileTornoPage((page) => Math.min(tornoMobilePageCount - 1, page + 1));
      return;
    }
    if (step === 2 && !validateStep2()) return;
    setStep((s) => ((s + 1) as 1 | 2 | 3));
  };

  const buildPayload = (): EditablePayload => {
    if (!info) return {} as EditablePayload;

    const { editableKeys } = info;
    const payload: EditablePayload = {};

    // Añadir solo los campos editables que han cambiado
    if (editableKeys.includes('locomotiveNumber') && String(locomotiveNumber) !== String(info.movimiento.locomotiveNumber ?? '')) {
      payload.locomotiveNumber = Number(locomotiveNumber) || 0;
    }

    if (editableKeys.includes('viaOrigenId') && viaOrigenId !== info.movimiento.viaOrigen?.id) {
      payload.viaOrigenId = viaOrigenId;
    }

    if (editableKeys.includes('viaDestinoId') && viaDestinoId !== info.movimiento.viaDestino?.id) {
      payload.viaDestinoId = viaDestinoId;
    }

    if (editableKeys.includes('tipoMovimiento') && tipoMovimiento !== info.movimiento.tipoMovimiento) {
      if (tipoMovimiento) payload.tipoMovimiento = tipoMovimiento;
    }

    if (editableKeys.includes('posicionCabina') && posicionCabina !== info.movimiento.posicionCabina) {
      payload.posicionCabina = posicionCabina;
    }

    if (editableKeys.includes('posicionChimenea') && posicionChimenea !== info.movimiento.posicionChimenea) {
      payload.posicionChimenea = posicionChimenea;
    }

    if (editableKeys.includes('direccionEmpuje') && direccionEmpuje !== info.movimiento.direccionEmpuje) {
      payload.direccionEmpuje = direccionEmpuje;
    }

    if ((editableKeys.includes('torno') && editableKeys.includes('lavado'))) {
      payload.torno = serviceVia === "Torno"
      payload.lavado = serviceVia === "Lavado";
    }

    if (isTornoModuleEnabled && serviceVia === "Torno") {
      const currentTornoSerialized = serializeTornoMedicion(tornoMedicion);
      if (currentTornoSerialized !== initialTornoSerialized) {
        payload.medidasTorno = buildBackendTornoMedidas({
          tornoMedicion,
          companyName: info.movimiento.empresa?.nombre,
        });
      }
    }

    // Polo is now included in the instructions, not in the payload

    // Construir instrucciones con metadatos
    const autoDesc = buildAutoDescription(viaOrigenId, viaDestinoId, fromSection, toSection, polo);
    const metaParts: string[] = [];
    if (typeof toSection === 'number') metaParts.push(`[META DESTINO:${toSection}]`);
    if (typeof fromSection === 'number') metaParts.push(`[META ORIGEN:${fromSection}]`);

    const finalInstr = [metaParts.join(' '), autoDesc, instrucciones?.trim() || '']
      .filter(Boolean)
      .join(' ')
      .trim();

    if (info.editableKeys.includes('instrucciones')) payload.instrucciones = finalInstr;

    return payload;
  };

  /** Guardar */
  const onSubmit = async (options?: { trainingConfirmed?: boolean }) => {
    if (saving || saveLockRef.current) return;
    if (!info) return;
    if (!validateStep2()) return;

    const payload = buildPayload();
    if (isTrainingEditor) {
      if (!options?.trainingConfirmed) {
        setShowTrainingSaveConfirmation(true);
        return;
      }
      setShowTrainingSaveConfirmation(false);
      saveLockRef.current = true;

      const originName = viaOrigenId ? viaName(viaOrigenId) : "";
      const destinationName = viaDestinoId ? viaName(viaDestinoId) : "";
      const formatTrainingVia = (name: string) => !name
        ? null
        : name.toLowerCase() === "torno" ? "Torno" : `Vía ${name}`;
      const patch: Partial<Movement> = {
        locomotora: locomotiveNumber || trainingMovement?.locomotora || "SIM",
        viaOrigen: formatTrainingVia(originName),
        viaDestino: formatTrainingVia(destinationName),
        tipoMovimiento: tipoMovimiento || trainingMovement?.tipoMovimiento || "MD_TRABAJANDO",
        prioridad: form.priority ? "ALTA" : "BAJA",
        posicionCabina,
        posicionChimenea,
        direccionEmpuje,
        torno: serviceVia === "Torno",
        lavado: serviceVia === "Lavado",
        instrucciones: String(
          payload.instrucciones
          || instrucciones.trim()
          || trainingMovement?.instrucciones
          || "Movimiento editado durante la capacitación."
        ),
      };

      try {
        setSaving(true);
        // Primero iniciamos la salida del editor. Si actualizamos el contexto
        // antes, su efecto de hidratación reinicia el formulario al paso 1 y
        // cancela visualmente la navegación.
        router.replace(`${training.roleBase}/movimientos`);
        window.setTimeout(() => {
          training.updateMovement(numericMovementId, patch);
          onSaved?.({ ...trainingMovement, ...patch });
        }, 1_000);
      } finally {
        saveLockRef.current = false;
        setSaving(false);
      }
      return;
    }

    if (Object.keys(payload).length === 0) {
      alert("No hay cambios por guardar.");
      return;
    }

    try {
      saveLockRef.current = true;
      setSaving(true);
      const updated = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      // Éxito
      onSaved?.(updated);
      const next = roleToPath(rol);
      router.push(next);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al guardar cambios.");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
        <div className="text-slate-600 dark:text-slate-300 animate-pulse">Cargando editor…</div>
      </div>
    );
  }
  if (error || !info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 p-6 flex items-center justify-center">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200 shadow-lg max-w-md text-center">
          <p className="font-medium mb-2">Error</p>
          {error || "No se pudo cargar la información de edición."}
          <button onClick={closeEditor} className="mt-4 text-sm underline hover:text-rose-900 dark:hover:text-rose-100">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const estadoActual = String(info.movimiento.estado || "").toUpperCase();
  const estadosPermitidos = (info.restricciones?.estadosPermitidos ?? []).map((e) =>
    String(e || "").toUpperCase()
  );
  const overrideEditable =
    estadosPermitidos.includes(estadoActual) ||
    ["DETENIDO", "EN_PROCESO", "CONCLUIDO"].includes(estadoActual);
  const readOnly = !info.editable && !overrideEditable;
  const empresaLabel = info.movimiento.empresa?.nombre ?? "Sin empresa";
  const localidadLabel = info.movimiento.localidad?.nombre ?? "Sin localidad";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-white transition-colors duration-200 p-4 md:p-6 lg:p-8">
      {/* Grid Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.05]"
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        {isTrainingEditor && (
          <div
            role="status"
            data-training-sandbox="true"
            className="mb-4 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100"
          >
            <strong className="block text-xs font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              Capacitación · edición SIM
            </strong>
            Estás editando un registro ficticio en el formulario real. Guardar requiere confirmación y nunca ejecutará un PATCH ni modificará datos productivos.
          </div>
        )}

        {/* Top Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={readOnly ? "warn" : "ok"}>
            {readOnly
              ? info.restricciones.motivo || "No editable"
              : info.editable
                ? "Editable"
                : "Editable (estado permitido)"}
          </Badge>
          <RoleBadge rol={rol} canManageAll={canManageAll} />

          {!isTrainingEditor && (
            <button
              onClick={() => setEditFlowMode((current) => current === "mobile" ? "classic" : "mobile")}
              className={Movimiento.clsx(
                "rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all active:scale-95",
                isMobileEditFlow
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              {isMobileEditFlow ? "Vista avanzada" : "Flujo guiado"}
            </button>
          )}

          <button
            onClick={closeEditor}
            className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95"
            title="Volver"
          >
            Salir
          </button>
        </div>

        {/* Header con icono */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              Editar Movimiento #{info.movimiento.id}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
          {isMobileEditFlow ? (
            <div className="ml-auto rounded-2xl bg-emerald-50 px-3 py-1.5 text-center dark:bg-emerald-950/40">
              <div className="text-lg font-black leading-5 text-emerald-700 dark:text-emerald-300">{mobileProgress}%</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">completado</div>
            </div>
          ) : null}
        </div>

        {/* Stepper */}
        <div className={Movimiento.clsx("mt-5 items-center justify-center gap-0", isMobileEditFlow ? "hidden" : "flex")} aria-label="Progreso">
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={Movimiento.clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                    s < step
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                      : s === step
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  )}
                >
                  {s < step ? "✓" : s}
                </div>
                <span className={Movimiento.clsx(
                  "text-[10px] font-semibold transition-colors",
                  s <= step ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                )}>
                  {["Datos", "Detalles", "Confirmar"][i]}
                </span>
              </div>
              {i < 2 && (
                <div className="flex-1 mx-2 mb-4">
                  <div className="h-0.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: s < step ? "100%" : "0%" }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card Content */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 bg-white/95 dark:bg-slate-950/90 backdrop-blur-sm p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30">
          {isMobileEditFlow ? (
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Editar movimiento</p>
                  <h2 className="truncate text-lg font-black text-slate-950 dark:text-white">{mobileStepTitle}</h2>
                </div>
                <div className="rounded-xl bg-white px-3 py-1 text-xs font-black text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300">
                  {mobileCurrentUnit}/{mobileTotalUnits}
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/70">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-300" style={{ width: `${mobileProgress}%` }} />
              </div>
            </div>
          ) : null}
          <div key={mobileTransitionKey} className={isMobileEditFlow ? "animate-in fade-in slide-in-from-right-2 duration-200" : undefined}>
          {step === 1 && (
            <GuidedTarget id="edit-movement-step-1">
              <Step1Edit
                readOnly={readOnly}
                form={form}
                vias={vias}
                sectionsByVia={sectionsByVia}
                secLoading={secLoading}
                selectionMode={selectionMode}
                serviceVia={serviceVia}
                setServiceVia={setServiceVia}
                setSelectionMode={setSelectionMode}
                ensureSections={ensureSections}
                viaOrigenId={viaOrigenId}
                setViaOrigenId={setViaOrigenId}
                viaDestinoId={viaDestinoId}
                setViaDestinoId={setViaDestinoId}
                fromSection={fromSection}
                setFromSection={setFromSection}
                toSection={toSection}
                setToSection={setToSection}
                locomotiveNumber={locomotiveNumber}
                setLocomotiveNumber={setLocomotiveNumber}
                viaName={viaName}
                tapToggle={tapToggle}
                setForm={setForm}
                errors={errors}
                empresaLabel={empresaLabel}
                localidadLabel={localidadLabel}
                visualSection={isMobileEditFlow ? mobileStepOneSection : undefined}
              />
            </GuidedTarget>
          )}

          {step === 2 && (
            <GuidedTarget id="edit-movement-step-2">
            <div className="space-y-4">
              <Step2Edit
                readOnly={readOnly || saving}
                tipoMovimiento={tipoMovimiento}
                setTipoMovimiento={setTipoMovimiento}
                posicionCabina={posicionCabina}
                setPosicionCabina={setPosicionCabina}
                posicionChimenea={posicionChimenea}
                setPosicionChimenea={setPosicionChimenea}
                direccionEmpuje={direccionEmpuje}
                setDireccionEmpuje={setDireccionEmpuje}
                polo={polo}
                setPolo={setPolo}
                errors={errors}
              />

              {isTornoModuleEnabled && serviceVia === "Torno" ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tornoEditorSubtitle}</h4>
                      {isMobileTornoEditor ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Pagina {mobileTornoPage + 1} de {tornoMobilePageCount}
                        </p>
                      ) : null}
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-sm dark:border-slate-700 dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={() => setTornoEditMode("mobile")}
                        className={Movimiento.clsx(
                          "rounded-lg px-3 py-1.5 transition-all",
                          tornoEditMode === "mobile"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        Guiada
                      </button>
                      <button
                        type="button"
                        onClick={() => setTornoEditMode("classic")}
                        className={Movimiento.clsx(
                          "rounded-lg px-3 py-1.5 transition-all",
                          tornoEditMode === "classic"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        Avanzada
                      </button>
                    </div>
                  </div>

                  <div className={Movimiento.clsx(readOnly || saving ? "pointer-events-none opacity-70" : "")}>
                    {isMobileTornoEditor ? (
                      <MobileGuidedTornoMeasuresStep
                        form={tornoStepForm}
                        setForm={setTornoStepForm}
                        tornoMedicion={tornoMedicion}
                        setTornoWheelCount={setTornoWheelCount}
                        updateTornoMedicion={updateTornoMedicion}
                        companyName={info.movimiento.empresa?.nombre}
                        visualPage={mobileTornoPage}
                      />
                    ) : (
                      <StepTwoTorno
                        form={tornoStepForm}
                        setForm={setTornoStepForm}
                        errors={{
                          movementType: errors.tipoMovimiento,
                          direccionEmpuje: errors.direccionEmpuje,
                        }}
                        tornoMedicion={tornoMedicion}
                        initialTornoMedicion={initialTornoMedicion}
                        setTornoWheelCount={setTornoWheelCount}
                        updateTornoMedicion={updateTornoMedicion}
                        companyName={info.movimiento.empresa?.nombre}
                        hideTypeSelector
                      />
                    )}
                  </div>
                </section>
              ) : null}
            </div>
            </GuidedTarget>
          )}

          {step === 3 && (
            <GuidedTarget id="edit-movement-step-3">
              <Step3Edit
                readOnly={readOnly}
                instrucciones={instrucciones}
                setInstrucciones={setInstrucciones}
                resumen={{
                  localidad: info.movimiento.localidad?.nombre,
                  origen: viaOrigenId ? `Vía ${viaName(viaOrigenId)}${fromSection ? ` (Sección #${fromSection})` : ""}` : "—",
                  destino: viaDestinoId ? `Vía ${viaName(viaDestinoId)}${toSection ? ` (Sección #${toSection})` : ""}` : "—",
                  loco: locomotiveNumber || "—",
                  tipo: tipoMovimiento || "—",
                  dir: direccionEmpuje || "—",
                }}
                metaHint={
                  (fromSection ? `[META ORIGEN:${fromSection}] ` : "") +
                  (toSection ? `[META SECCION:${toSection}]` : "")
                }
                saving={saving}
                onSubmit={onSubmit}
              />
            </GuidedTarget>
          )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="mt-5 flex flex-wrap gap-3">
          {(step > 1 || (isMobileEditFlow && step === 1 && mobileStepOnePage > 0)) && (
            <button
              onClick={goPreviousStep}
              className="rounded-xl border border-amber-300 dark:border-amber-700 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-[0.97]"
            >
              ← Anterior
            </button>
          )}
          {step < 3 && (
            <GuidedTarget id="edit-movement-next-step" className="inline-flex">
              <button
                onClick={goNextStep}
                className={Movimiento.clsx(
                  "rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.97]",
                  readOnly
                    ? "bg-slate-400 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-emerald-500/40 hover:from-emerald-600 hover:to-emerald-700"
                )}
                disabled={readOnly}
              >
                Siguiente →
              </button>
            </GuidedTarget>
          )}
          <button
            onClick={closeEditor}
            className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95"
            title="Volver"
          >
            Salir
          </button>
        </div>

        {isTornoModuleEnabled ? <TornoMeasuresViewerModal
          open={showTornoViewerModal}
          onClose={() => setShowTornoViewerModal(false)}
          tornoMedicion={tornoMedicion}
          locomotiveLabel={locomotiveNumber || String(info.movimiento.locomotiveNumber ?? "")}
          companyName={info.movimiento.empresa?.nombre}
        /> : null}

        {showTrainingSaveConfirmation ? (
          <div
            className="fixed inset-0 z-[100020] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="training-edit-confirm-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-5 text-slate-900 shadow-2xl dark:border-amber-700 dark:bg-slate-950 dark:text-white">
              <h2 id="training-edit-confirm-title" className="text-lg font-black">
                ¿Guardar este cambio SIM?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Sólo se actualizará SIM-MOV-305 dentro de esta capacitación. No se enviará ningún PATCH ni se modificará la operación real.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowTrainingSaveConfirmation(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  No, seguir revisando
                </button>
                <button
                  type="button"
                  data-guide-action="confirm-training-edit-save"
                  onClick={() => void onSubmit({ trainingConfirmed: true })}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                >
                  Sí, guardar cambio SIM
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
