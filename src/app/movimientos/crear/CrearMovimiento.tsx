"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMounted } from "@/app/hooks/useMounted";
import {
  GuidedTarget,
  useGuidedManual,
  useGuidedManualApi,
} from "@/app/Components/GuidedManualAtom";
import { useTrainingTour } from "@/app/Components/GuidedManualAtom/TrainingTourContext";
import { getInitialTheme, applyTheme, onThemeChange } from "@/lib/theme";
import { Movimiento } from "../Movimiento";
import StepOne from "./components/StepOne";
import StepTwo from "./components/StepTwo";
import StepTwoTorno from "./components/StepTwoTorno";
import StepThree from "./components/StepThree";
import StepFourTorno from "./components/StepFourTorno";
import MobileGuidedTornoMeasuresStep, {
  getGuidedTornoMeasuresPageCount,
  getGuidedTornoMeasuresPageTitle,
} from "./components/MobileGuidedTornoMeasuresStep";
import { Badge, RoleBadge } from "./components/ui";
import { useCrearMovimientoController } from "./useCrearMovimientoController";

/**
 * Pantalla principal "Crear Movimiento".
 *
 * Enfoque declarativo:
 * - Este componente NO define reglas de negocio complejas.
 * - Consume el hook controlador y conecta estado/acciones con la UI.
 * - Cada step es un componente aislado.
 */
export default function CrearMovimiento() {
  const mounted = useMounted();
  const router = useRouter();
  const searchParams = useSearchParams();
  const training = useTrainingTour();
  // El query mantiene el sandbox aunque el usuario cierre el tour o recargue
  // con un diálogo abierto. Quitar el query no lo desactiva mientras el tour siga activo.
  const sandboxRequested = training.active || searchParams.get("training") === "1";
  const sandboxAtMountRef = useRef(sandboxRequested);
  if (sandboxRequested) sandboxAtMountRef.current = true;
  const sandboxMode = sandboxRequested || sandboxAtMountRef.current;
  const guidedManual = useGuidedManual();
  const guidedManualApi = useGuidedManualApi();
  const [guidedMode, setGuidedMode] = useState(true);
  const [guidedStepOnePage, setGuidedStepOnePage] = useState(0);
  const [guidedTornoMeasuresPage, setGuidedTornoMeasuresPage] = useState(0);

  useEffect(() => {
    if (guidedManual?.isOpen) {
      const isMobileGuide = guidedManual.currentStep?.id?.startsWith("mobile-");
      setGuidedMode(!!isMobileGuide);
    }
  }, [guidedManual?.isOpen, guidedManual?.currentStep?.id]);

  /** Sincroniza tema visual con preferencia actual y cambios entre pestañas. */
  useEffect(() => {
    if (!mounted) return;
    const initial = getInitialTheme();
    applyTheme(initial, { persist: false });

    const unsubscribe = onThemeChange((newTheme) => {
      applyTheme(newTheme, { persist: false });
    });

    return () => unsubscribe();
  }, [mounted]);

  /** Contrato unico de estado/acciones que maneja todo el flujo. */
  const {
    step,
    form,
    setForm,
    sending,
    errors,
    banner,
    empresas,
    localidades,
    vias,
    viasLoading,
    viasError,
    reloadVias,
    sectionsByVia,
    secLoading,
    rol,
    canManageAll,
    canChooseLocality,
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
    submit,
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
    clearTornoMedicion,
    clearOutbox,
  } = useCrearMovimientoController({ sandbox: sandboxMode });

  const trainingScenario = sandboxMode
    ? guidedManual?.currentStep?.id?.startsWith("tour-torno-")
      ? "torno"
      : training.trainingScenario
    : null;
  const trainingSubmitLockRef = useRef(false);

  const validateTrainingScenario = useCallback((announce = true) => {
    if (!sandboxMode) return true;
    const valid = trainingScenario === "torno" ? form.service === "Torno" : !form.service;
    if (!valid && announce) {
      window.alert(
        trainingScenario === "torno"
          ? "Este ejercicio es de Torno. Selecciona Torno en Servicio antes de avanzar."
          : "Este primer ejercicio es un movimiento Natural. Deja Servicio sin seleccionar; Torno se practicará después."
      );
    }
    return valid;
  }, [form.service, sandboxMode, trainingScenario]);

  const submitTrainingMovement = useCallback(() => {
    if (!sandboxMode || trainingSubmitLockRef.current) return;
    if (step !== 3) {
      window.alert("Completa Datos y Detalles antes de confirmar el movimiento SIM.");
      return;
    }
    const validStepOne = validate1();
    const validStepTwo = validate2();
    if (!validStepOne || !validStepTwo || !validateTrainingScenario()) {
      window.alert("Faltan datos obligatorios. Revisa los campos marcados antes de crear el movimiento SIM.");
      return;
    }
    if (form.service === "Torno") {
      const hasMeasure = Object.values(tornoMedicion.rows).some((row) =>
        Object.values(row ?? {}).some((value) => Boolean(value?.whole || value?.num || value?.den))
      );
      if (!hasMeasure) {
        window.alert("Captura al menos una medida ficticia de Torno antes de confirmar.");
        return;
      }
    }
    trainingSubmitLockRef.current = true;
    training.createMovement(form);
    router.push(`${training.roleBase}/movimientos`);
  }, [form, router, sandboxMode, step, tornoMedicion.rows, training, validate1, validate2, validateTrainingScenario]);

  const safeSubmit = sandboxMode ? submitTrainingMovement : submit;
  const safeExit = sandboxMode
    ? () => router.push(`${training.roleBase}/movimientos`)
    : goSalir;

  // El controlador conserva su atajo de teclado de producción. En capacitación
  // lo interceptamos en captura para que Ctrl/Cmd + Enter tampoco pueda enviar
  // una solicitud real por accidente.
  useEffect(() => {
    if (!sandboxMode) return;
    const onTrainingSubmitShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "enter") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (step === 3) submitTrainingMovement();
      else window.alert("Primero completa los pasos anteriores; el atajo no puede saltarse validaciones.");
    };
    window.addEventListener("keydown", onTrainingSubmitShortcut, true);
    return () => window.removeEventListener("keydown", onTrainingSubmitShortcut, true);
  }, [sandboxMode, step, submitTrainingMovement]);

  const useTornoMedicionStep = hasTornoPdfStep;
  useEffect(() => {
    if (!guidedMode || step !== 1) setGuidedStepOnePage(0);
  }, [guidedMode, step]);

  useEffect(() => {
    if (!guidedMode || step !== 2 || !useTornoMedicionStep) setGuidedTornoMeasuresPage(0);
  }, [guidedMode, step, useTornoMedicionStep]);

  const stepNames = useTornoMedicionStep
    ? (["Datos", "Medicion", "Confirmar", "PDF"] as const)
    : (["Datos", "Detalles", "Confirmar"] as const);
  const currentStepIndex = Math.max(0, Math.min(step - 1, stepNames.length - 1));
  const guidedTornoPageCount = getGuidedTornoMeasuresPageCount();
  const guidedTotalUnits = guidedMode ? (useTornoMedicionStep ? 8 : 6) : stepNames.length;
  const guidedCurrentUnit = guidedMode
    ? step === 1
      ? guidedStepOnePage + 1
      : step === 2 && useTornoMedicionStep
        ? 4 + guidedTornoMeasuresPage + 1
        : step === 2
          ? 5
          : step === 3
            ? (useTornoMedicionStep ? 7 : 6)
            : 8
    : currentStepIndex + 1;
  const guidedProgress = Math.round((guidedCurrentUnit / guidedTotalUnits) * 100);
  const stepTransitionKey = guidedMode
    ? `${step}:${guidedStepOnePage}:${guidedTornoMeasuresPage}:${useTornoMedicionStep ? "torno" : "movimiento"}`
    : `${step}:${useTornoMedicionStep ? "torno" : "movimiento"}`;
  const title = useTornoMedicionStep && step === 2 ? "Medicion de Ruedas" : "Nuevo Movimiento";
  const pageTitle = useTornoMedicionStep && step === 4 ? "Resumen de Medidas" : title;
  const nextLabel =
    useTornoMedicionStep && step === 2
      ? (tornoStep2Completed && tornoMovimientoId !== null ? "Volver al PDF →" : "Guardar y Continuar →")
      : "Siguiente →";
  const isTornoMeasurementStep = useTornoMedicionStep && step === 2;
  const clearAction = isTornoMeasurementStep ? clearTornoMedicion : clearForm;
  const clearLabel = isTornoMeasurementStep ? "Limpiar mediciones" : "Limpiar";
  const selectedCompanyName =
    empresas.find((empresa) => empresa.id === form.empresaId)?.nombre ||
    userCompanyName ||
    "";
  const guidedStepOneSections = ["context", "service", "locomotive", "route"] as const;
  const guidedStepOneTitles = ["Empresa y localidad", "Servicio", "Locomotora", "Via y seccion"];
  const guidedStepOneSection = guidedStepOneSections[guidedStepOnePage] ?? "context";
  const guidedStepTitle = guidedMode
    ? step === 1
      ? guidedStepOneTitles[guidedStepOnePage] ?? "Configuracion"
      : step === 2 && useTornoMedicionStep
        ? getGuidedTornoMeasuresPageTitle(guidedTornoMeasuresPage, tornoMedicion.wheelCount)
        : stepNames[currentStepIndex]
    : stepNames[currentStepIndex];
  const hasAnyTornoMeasure = useMemo(
    () => Object.values(tornoMedicion.rows).some((row) =>
      Object.values(row ?? {}).some((value) => Boolean(value?.whole || value?.num || value?.den))
    ),
    [tornoMedicion.rows]
  );
  const trainingStepOneReady = useMemo(() => {
    if (!sandboxMode) return true;
    const companyReady = !canManageAll || Number(form.empresaId) > 0;
    const localityReady = !canChooseLocality || Number(form.selectedLocalityId) > 0;
    const routeReady = form.service
      ? (selectionMode === "de_via" ? Number(form.fromTrack) > 0 : Number(form.toTrack) > 0)
      : Number(form.fromTrack) > 0 && Number(form.toTrack) > 0;
    const scenarioReady = trainingScenario === "torno" ? form.service === "Torno" : !form.service;
    return companyReady && localityReady && routeReady && scenarioReady && form.locomotiveNumber.trim().length > 0;
  }, [
    canChooseLocality,
    canManageAll,
    form.empresaId,
    form.fromTrack,
    form.locomotiveNumber,
    form.selectedLocalityId,
    form.service,
    form.toTrack,
    sandboxMode,
    selectionMode,
    trainingScenario,
  ]);
  const trainingStepTwoReady = useMemo(() => {
    if (!sandboxMode || !form.movementType) return !sandboxMode;
    if (form.movementType === "REMOLCADA" && !["EMPUJAR", "JALAR"].includes(form.direccionEmpuje || "")) {
      return false;
    }
    if (!form.service) {
      const hasChimney = ["DENTRO", "AFUERA"].includes(form.chimneyPosition);
      const hasPole = ["NORTE", "SUR"].includes(form.polo);
      if (!hasChimney && !hasPole) return false;
    }
    return !useTornoMedicionStep || hasAnyTornoMeasure;
  }, [
    form.chimneyPosition,
    form.direccionEmpuje,
    form.movementType,
    form.polo,
    form.service,
    hasAnyTornoMeasure,
    sandboxMode,
    useTornoMedicionStep,
  ]);
  const trainingNextBlocked = sandboxMode && !guidedMode && (
    (step === 1 && !trainingStepOneReady) || (step === 2 && !trainingStepTwoReady)
  );
  const trainingNextHint = step === 1
    ? trainingScenario === "torno"
      ? "Para continuar: selecciona Torno, empresa/localidad, locomotora y una vía válida."
      : "Para continuar: deja Servicio sin seleccionar y completa empresa/localidad, locomotora, origen y destino."
    : useTornoMedicionStep
      ? "Para continuar: completa tipo, dirección cuando aplique y al menos una medición ficticia."
      : "Para continuar: completa tipo, dirección cuando aplique y posición de chimenea o polo.";
  const contentMaxWidth = guidedMode
    ? "max-w-5xl"
    : useTornoMedicionStep
      ? "max-w-7xl"
      : "max-w-4xl";
  const validateGuidedMiniStep = () => {
    if (!guidedMode) return true;
    if (step === 1 && guidedStepOnePage === 0) {
      if (!Number(form.empresaId)) {
        window.alert("Selecciona la empresa antes de continuar.");
        return false;
      }
      if (!Number(form.selectedLocalityId)) {
        window.alert("Selecciona la localidad antes de continuar.");
        return false;
      }
    }
    if (step === 1 && guidedStepOnePage === 1 && form.service === "Torno" && form.agendado) {
      const scheduledAt = new Date(form.fechaProgramada || "");
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        window.alert("Selecciona una fecha y hora valida para agendar el torno.");
        return false;
      }
    }
    if (step === 1 && guidedStepOnePage === 2 && !Number(form.locomotiveNumber)) {
      window.alert("Captura el numero de locomotora antes de continuar.");
      return false;
    }
    if (step === 2 && useTornoMedicionStep && guidedTornoMeasuresPage >= guidedTornoPageCount - 1 && !hasAnyTornoMeasure) {
      window.alert("Captura al menos una medida de torno antes de revisar la solicitud.");
      return false;
    }
    return true;
  };
  const guidedGoNext = () => {
    if (!guidedMode) {
      if (trainingNextBlocked) {
        if (step === 1) validate1();
        if (step === 2) validate2();
        window.alert(trainingNextHint);
        return;
      }
      goNext();
      return;
    }
    if (!validateGuidedMiniStep()) return;
    if (step === 1 && guidedStepOnePage < guidedStepOneSections.length - 1) {
      setGuidedStepOnePage((page) => page + 1);
      return;
    }
    if (step === 2 && useTornoMedicionStep && guidedTornoMeasuresPage < guidedTornoPageCount - 1) {
      setGuidedTornoMeasuresPage((page) => page + 1);
      return;
    }
    if (step === 1 && !validateTrainingScenario()) return;
    goNext();
  };
  const guidedGoPrev = () => {
    if (!guidedMode) {
      goPrev();
      return;
    }
    if (step === 1 && guidedStepOnePage > 0) {
      setGuidedStepOnePage((page) => page - 1);
      return;
    }
    if (step === 2 && useTornoMedicionStep && guidedTornoMeasuresPage > 0) {
      setGuidedTornoMeasuresPage((page) => page - 1);
      return;
    }
    if (step === 2) {
      setGuidedStepOnePage(guidedStepOneSections.length - 1);
      goPrev();
      return;
    }
    if (step === 3 && useTornoMedicionStep) {
      setGuidedTornoMeasuresPage(Math.max(0, guidedTornoPageCount - 1));
      goPrev();
      return;
    }
    goPrev();
  };
  const showPreviousButton = guidedMode
    ? step > 1 || guidedStepOnePage > 0 || (step === 2 && useTornoMedicionStep && guidedTornoMeasuresPage > 0)
    : step > 1;
  const showNextButton = guidedMode
    ? step < 3 || (step === 2 && useTornoMedicionStep && guidedTornoMeasuresPage < guidedTornoPageCount - 1)
    : step < 3;
  const guidedNextLabel = guidedMode
    ? step === 1 && guidedStepOnePage < guidedStepOneSections.length - 1
      ? "Continuar"
      : step === 2 && useTornoMedicionStep && guidedTornoMeasuresPage < guidedTornoPageCount - 1
        ? "Siguiente grupo"
        : nextLabel
    : nextLabel;

  useEffect(() => {
    const contextPatch = {
      route: "movimientos.crear",
      "createMovement.mode": guidedMode ? "mobile" : "classic",
      "createMovement.step": step,
      "createMovement.stepTitle": guidedStepTitle,
      "createMovement.progress": guidedProgress,
      "createMovement.variant": useTornoMedicionStep ? "torno" : "standard",
      "createMovement.service": form.service || "",
      "createMovement.isScheduled": Boolean(form.agendado),
      "createMovement.selectionMode": selectionMode,
      "createMovement.stepOnePage": guidedStepOnePage,
      "createMovement.stepOneSection": guidedStepOneSection,
      "createMovement.tornoMeasuresPage": guidedTornoMeasuresPage,
      "createMovement.tornoWheelCount": tornoMedicion.wheelCount,
      "createMovement.hasAnyTornoMeasure": hasAnyTornoMeasure,
      "createMovement.localityId": form.selectedLocalityId || null,
      "createMovement.locomotiveNumber": form.locomotiveNumber || null,
      "createMovement.nextActionLabel": guidedNextLabel,
      "createMovement.sending": sending,
    };
    guidedManualApi?.mergeContext(contextPatch);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cosaif:guided-context", { detail: contextPatch }));
    }
  }, [
    form.agendado,
    form.locomotiveNumber,
    form.selectedLocalityId,
    form.service,
    guidedManualApi,
    guidedMode,
    guidedNextLabel,
    guidedProgress,
    guidedStepOnePage,
    guidedStepOneSection,
    guidedStepTitle,
    guidedTornoMeasuresPage,
    hasAnyTornoMeasure,
    selectionMode,
    sending,
    step,
    tornoMedicion.wheelCount,
    useTornoMedicionStep,
  ]);

  if (!mounted) return null;

  return (
      <div className={Movimiento.clsx(
        "min-h-screen overflow-x-hidden p-2 text-slate-900 transition-colors duration-200 dark:text-white min-[380px]:p-3 sm:p-4 md:p-6 lg:p-8",
        guidedMode
          ? "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff)] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(135deg,#09090b,#18181b)]"
          : "bg-gradient-to-br from-slate-50 to-white dark:from-zinc-950 dark:to-zinc-900"
      )}>
      <style jsx global>{`
        @media (max-width: 640px) {
          select, select option { font-size: 16px !important; line-height: 1.45 !important; }
          select { min-height: 48px !important; }
        }
        @keyframes createMovementGuidedStepIn {
          from { opacity: 0; transform: translate3d(18px, 0, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .create-movement-guided-step {
          animation: createMovementGuidedStepIn 190ms cubic-bezier(.2,.8,.2,1);
          will-change: transform, opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .create-movement-guided-step {
            animation: none !important;
            will-change: auto;
          }
        }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.05]"
      />
      {guidedMode && (
        <div className="cosaif-motion-panel fixed inset-x-0 top-0 z-40 border-b border-emerald-100 bg-white/95 px-3 py-1.5 shadow-lg shadow-emerald-100/30 backdrop-blur dark:border-emerald-900/40 dark:bg-zinc-950/95 dark:shadow-none sm:px-5 sm:py-2">
          <div className={Movimiento.clsx("mx-auto flex min-w-0 items-center gap-3", contentMaxWidth)}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 sm:h-10 sm:w-10 sm:rounded-2xl">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950 dark:text-white sm:text-base">
                {pageTitle}
              </div>
              <div className="truncate text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {guidedStepTitle}
              </div>
            </div>
            <div className="cosaif-motion-emphasis rounded-xl bg-emerald-50 px-2.5 py-1 text-center dark:bg-emerald-950/40 sm:rounded-2xl sm:px-3 sm:py-1.5">
              <div className="text-base font-black leading-5 text-emerald-700 dark:text-emerald-300 sm:text-lg">{guidedProgress}%</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">completado</div>
            </div>
          </div>
          <div className={Movimiento.clsx("mx-auto mt-1.5 h-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/70 sm:mt-2 sm:h-1.5", contentMaxWidth)}>
            <div
              className="cosaif-motion-progress h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500"
              style={{ width: `${guidedProgress}%` }}
            />
          </div>
        </div>
      )}
      <div
        data-guide-movement-variant={useTornoMedicionStep ? "torno" : "standard"}
        data-guide-movement-step={step}
        className={Movimiento.clsx(
          "relative z-10 mx-auto w-full min-w-0",
          guidedMode && "pt-[4.75rem] pb-28 sm:pt-20 sm:pb-28 md:pb-24",
          contentMaxWidth
        )}
      >

        {sandboxMode && (
          <div
            role="status"
            data-training-sandbox="true"
            className="mb-4 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100"
          >
            <strong className="block text-xs font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              Capacitación · datos SIM
            </strong>
            Practica en el formulario real. Al confirmar se guardará únicamente un movimiento ficticio en esta capacitación; no se enviará nada al sistema productivo.
          </div>
        )}

        <div className={Movimiento.clsx("flex min-w-0 flex-wrap items-center gap-2", guidedMode ? "mb-2" : "mb-4")}>
          <Badge tone={online ? "ok" : "error"}>{online ? "En línea" : "Sin conexión"}</Badge>
          <RoleBadge
            rol={rol}
            canManageAll={canManageAll}
            canChooseLocality={canChooseLocality}
          />
          {!sandboxMode && pendingCount > 0 && (
            <>
              <Badge tone="warn">{pendingCount} pendiente(s)</Badge>
              <button onClick={flushOutbox} className="rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all">
                Enviar pendientes
              </button>
              <button onClick={clearOutbox} className="rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all">
                Vaciar cola
              </button>
            </>
          )}
          {banner && <span className="text-xs text-slate-600 dark:text-zinc-300">{banner}</span>}
          <button
            type="button"
            onClick={() => setGuidedMode((current) => !current)}
            disabled={Boolean(training.active && guidedManual?.isOpen)}
            title={training.active && guidedManual?.isOpen ? "La vista se mantiene fija durante el recorrido para no perder el paso actual." : undefined}
            className={Movimiento.clsx(
              "cosaif-motion-button rounded-xl border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              guidedMode
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            {guidedMode ? "Vista avanzada" : "Flujo guiado"}
          </button>
          <button onClick={safeExit} className="cosaif-motion-button ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20" title="Volver a mis movimientos">
            Salir
          </button>
        </div>

        <div className={Movimiento.clsx("min-w-0 items-center gap-3", guidedMode ? "hidden" : "flex")}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent sm:text-2xl">
              {pageTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{label}</p>
          </div>
        </div>

        {lockedClienteMissingData && (
          <div className="mt-3 rounded-xl border-l-4 border-rose-500 bg-rose-50 p-3 text-sm dark:border-rose-600 dark:bg-rose-900/20">
            <div className="font-medium text-rose-800 dark:text-rose-200">
              Sesión inválida. Inicia sesión nuevamente.
            </div>
          </div>
        )}

        {/* Stepper declarativo (sin estado local extra). */}
        {!guidedMode && (
        <GuidedTarget id="create-movement-stepper">
        <div className={Movimiento.clsx(
          "mt-5 flex min-w-0 items-center justify-center gap-0",
          guidedMode && "rounded-2xl border border-emerald-100 bg-white/80 p-2 shadow-sm shadow-emerald-100/60 backdrop-blur dark:border-emerald-900/40 dark:bg-zinc-950/70 dark:shadow-none min-[380px]:p-3 sm:rounded-3xl sm:p-4"
        )} aria-label="Progreso">
          {stepNames.map((stepName, i) => {
            const s = i + 1;
            return (
            <React.Fragment key={s}>
              <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 sm:flex-none">
                <div
                  className={Movimiento.clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                    s < step
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                      : s === step
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20"
                        : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                  )}
                >
                  {s < step ? "✓" : s}
                </div>
                <span className={Movimiento.clsx(
                  "max-w-full truncate text-[9px] font-semibold transition-colors min-[380px]:text-[10px]",
                  s <= step ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"
                )}>
                  {stepName}
                </span>
              </div>
              {i < stepNames.length - 1 && (
                <div className="mx-1 mb-4 min-w-2 flex-1 sm:mx-2">
                  <div className="h-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="cosaif-motion-progress h-full rounded-full bg-emerald-500"
                      style={{ width: s < step ? "100%" : "0%" }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
            );
          })}
        </div>
        </GuidedTarget>
        )}

        {/* Contenido de steps (1,2,3) desacoplado en componentes especializados. */}
        <GuidedTarget id="create-movement-step-content">
        <div className={Movimiento.clsx(
          "cosaif-motion-card min-w-0 overflow-hidden border p-3 backdrop-blur-sm transition-colors min-[380px]:p-4",
          guidedMode
            ? "mt-2 rounded-2xl border-emerald-100 bg-white/95 shadow-xl shadow-emerald-100/40 dark:border-emerald-900/40 dark:bg-zinc-950/90 dark:shadow-none sm:rounded-[24px]"
            : "mt-4 rounded-2xl border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/30 dark:border-zinc-800/60 dark:bg-zinc-950/90 dark:shadow-zinc-900/30 sm:mt-6 sm:p-6"
        )}>
          <div key={stepTransitionKey} className={guidedMode ? "create-movement-guided-step" : undefined}>
          {step === 1 && (
            <GuidedTarget id="create-movement-step-1">
              <StepOne
                form={form}
                setForm={setForm}
                errors={errors}
                empresas={empresas}
                localidades={localidades}
                vias={vias}
                viasLoading={viasLoading}
                viasError={viasError}
                reloadVias={reloadVias}
                canManageAll={canManageAll}
                canChooseLocality={canChooseLocality}
                userCompanyName={userCompanyName}
                showFromOpts={showFromOpts}
                setShowFromOpts={setShowFromOpts}
                showToOpts={showToOpts}
                setShowToOpts={setShowToOpts}
                selectionMode={selectionMode}
                setSelectionMode={setSelectionMode}
                tapToggle={(k, a, b) => tapToggle(k, a, b)}
                sectionsByVia={sectionsByVia}
                secLoading={secLoading}
                ensureSections={ensureSections}
                fromSection={fromSection}
                toSection={toSection}
                setFromSection={selectFromSection}
                setToSection={setToSection}
                viaName={viaName}
                companyName={selectedCompanyName}
                scheduledTornoMovements={sandboxMode ? [] : scheduledTornoMovements}
                scheduledTornoLoading={sandboxMode ? false : scheduledTornoLoading}
                onRefreshScheduledTorno={sandboxMode ? async () => undefined : refreshScheduledTornoMovements}
                onActivateScheduledTorno={sandboxMode ? async () => undefined : activateScheduledTornoMovement}
                visualSection={guidedMode ? guidedStepOneSection : undefined}
              />
            </GuidedTarget>
          )}
          {step === 2 && !useTornoMedicionStep && (
            <GuidedTarget id="create-movement-step-2-standard">
              <StepTwo form={form} setForm={setForm} errors={errors} isService={isService} />
            </GuidedTarget>
          )}
          {step === 2 && useTornoMedicionStep && (
            <GuidedTarget id="create-movement-step-2-torno">
              {guidedMode ? (
                <MobileGuidedTornoMeasuresStep
                  form={form}
                  setForm={setForm}
                  tornoMedicion={tornoMedicion}
                  setTornoWheelCount={setTornoWheelCount}
                  updateTornoMedicion={updateTornoMedicion}
                  companyName={selectedCompanyName}
                  visualPage={guidedTornoMeasuresPage}
                />
              ) : (
                <StepTwoTorno
                  form={form}
                  setForm={setForm}
                  errors={errors}
                  tornoMedicion={tornoMedicion}
                  setTornoWheelCount={setTornoWheelCount}
                  updateTornoMedicion={updateTornoMedicion}
                  companyName={selectedCompanyName}
                />
              )}
            </GuidedTarget>
          )}
          {step === 3 && (
            <GuidedTarget id="create-movement-step-3">
              <StepThree
                form={form}
                setForm={setForm}
                sending={sandboxMode ? false : sending}
                submit={safeSubmit}
                submitLabel={sandboxMode ? "Crear movimiento SIM" : useTornoMedicionStep ? "Confirmar y Continuar al PDF" : undefined}
                fromSection={fromSection}
                toSection={toSection}
                viaName={viaName}
                selectionMode={selectionMode}
              />
            </GuidedTarget>
          )}
          {step === 4 && useTornoMedicionStep && (
            <GuidedTarget id="create-movement-step-4">
              <StepFourTorno
                form={form}
                tornoMedicion={tornoMedicion}
                companyName={selectedCompanyName}
                tornoMovimientoId={tornoMovimientoId}
                tornoPdfSending={tornoPdfSending}
                tornoPdfStatus={tornoPdfStatus}
                onEditMedicion={() => {
                  setGuidedTornoMeasuresPage(Math.max(0, guidedTornoPageCount - 1));
                  goBackToTornoMedicion();
                }}
                onGeneratePdf={generateTornoPdf}
              />
            </GuidedTarget>
          )}
          </div>
        </div>
        </GuidedTarget>

        {trainingNextBlocked ? (
          <p id="training-next-requirements" role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            {trainingNextHint}
          </p>
        ) : null}

        {/* Navegacion declarativa del wizard. */}
        <div className={Movimiento.clsx(
          "flex min-w-0 flex-wrap gap-2 sm:gap-3",
          guidedMode
            ? "fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[45] rounded-2xl border border-emerald-100 bg-white/95 p-2 shadow-[0_-10px_24px_rgba(16,185,129,0.12)] backdrop-blur dark:border-emerald-900/40 dark:bg-zinc-950/95 dark:shadow-none sm:inset-x-3 sm:p-2.5 md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0 md:pb-[calc(0.6rem+env(safe-area-inset-bottom))]"
            : "mt-5"
        )}>
          <button
            onClick={clearAction}
            className="cosaif-motion-button min-h-10 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 min-[420px]:flex-none sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            {clearLabel}
          </button>

          {showPreviousButton && !(useTornoMedicionStep && step === 4) && (
            <button
              onClick={guidedGoPrev}
              data-guide-action="create-movement-prev"
              className="cosaif-motion-button min-h-10 flex-1 rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 min-[420px]:flex-none sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              ← Anterior
            </button>
          )}

          {showNextButton && (
            <GuidedTarget id="create-movement-next-step" className="inline-flex min-w-0 flex-1 min-[420px]:flex-none">
              <button
                onClick={guidedGoNext}
                disabled={trainingNextBlocked}
                aria-describedby={trainingNextBlocked ? "training-next-requirements" : undefined}
                data-guide-action="create-movement-next"
                className="cosaif-motion-button min-h-10 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none sm:min-h-11 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {guidedNextLabel}
              </button>
            </GuidedTarget>
          )}

          <button
            onClick={safeExit}
            data-guide-action="create-movement-exit"
            className="cosaif-motion-button min-h-10 flex-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20 min-[420px]:ml-auto min-[420px]:flex-none sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-sm"
            title="Volver a mis movimientos"
          >
            Salir
          </button>
        </div>

        {locoLockedBy ? (
          <div className="mt-4 rounded-lg border-l-4 border-sky-400 bg-sky-50 p-3 text-sm dark:border-sky-600 dark:bg-sky-900/20">
            <div className="font-semibold text-sky-800 dark:text-sky-200">
              Locomotora bloqueada por sección #{locoLockedBy.numero} (movimiento #{locoLockedBy.movimientoId}).
            </div>
            <button onClick={() => setLocoLockedBy(null)} className="mt-2 rounded-md border px-3 py-1 text-xs hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
              Quitar vinculación
            </button>
          </div>
        ) : null}
      </div>
      </div>
  );
}
