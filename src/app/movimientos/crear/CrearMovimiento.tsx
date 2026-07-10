"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMounted } from "@/app/hooks/useMounted";
import {
  GuidedTarget,
  useGuidedManualApi,
  useGuidedManual,
  type GuidedManualStep,
} from "@/app/Components/GuidedManualAtom";
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


function TornoMeasurementGuideButton({ steps }: { steps: GuidedManualStep[] }) {
  const api = useGuidedManualApi();

  if (!api || steps.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => api.startWithSteps(steps, 0)}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-lg font-bold text-sky-700 shadow-sm transition-all hover:bg-sky-100 active:scale-[0.97] dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
      title="Mostrar guía de medición"
      aria-label="Mostrar guía de medición"
    >
      ?
    </button>
  );
}

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
  const guidedManual = useGuidedManual();
  const [guidedMode, setGuidedMode] = useState(false);
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
  } = useCrearMovimientoController();

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
  const tornoGuideSteps: GuidedManualStep[] = useTornoMedicionStep
    ? [
        {
          id: "torno-wheel-count",
          targetId: "torno-wheel-count",
          title: "Selecciona el numero de ruedas",
          description:
            "Empieza indicando cuantas ruedas vas a medir. La tabla se ajusta automaticamente al total que selecciones.",
          mode: "wizard",
        },
        {
          id: "torno-movement-type",
          targetId: "torno-movement-type",
          title: "Define el tipo de movimiento",
          description:
            "Marca si la locomotora viene trabajando o remolcada. Si eliges Remolcada, tambien se habilita la direccion para completar ese caso.",
          mode: "wizard",
        },
        {
          id: "torno-measures-table",
          targetId: "torno-measures-table",
          title: "Captura las medidas de cada rueda",
          description:
            "Llena cada celda usando entero, numerador y denominador en pulgadas. Puedes avanzar fila por fila hasta completar las posiciones necesarias.",
          mode: "wizard",
        },
      ]
    : [];
  const guidedStepDescription = useMemo(() => {
    if (step === 1) return "Completa los datos operativos, servicio, locomotora y vias necesarias.";
    if (step === 2 && useTornoMedicionStep) return "Registra medidas de torno con el formato configurado para la empresa.";
    if (step === 2) return "Define el tipo de movimiento y su orientacion operativa.";
    if (step === 3) return "Revisa la solicitud antes de crear el movimiento.";
    return "Genera el PDF o vuelve a editar las mediciones del torno.";
  }, [step, useTornoMedicionStep]);
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
      <div
        data-guide-movement-variant={useTornoMedicionStep ? "torno" : "standard"}
        data-guide-movement-step={step}
        className={Movimiento.clsx("relative z-10 mx-auto w-full min-w-0", contentMaxWidth)}
      >

        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone={online ? "ok" : "error"}>{online ? "En línea" : "Sin conexión"}</Badge>
          <RoleBadge rol={rol} canManageAll={canManageAll} />
          {pendingCount > 0 && (
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
            className={Movimiento.clsx(
              "rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all active:scale-[0.97]",
              guidedMode
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            {guidedMode ? "Vista clasica" : "Flujo mobile"}
          </button>
          <button onClick={goSalir} className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95" title="Volver a mis movimientos">
            Salir
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-3">
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
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
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

        {guidedMode && (
          <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-emerald-100 bg-white/90 p-3 shadow-xl shadow-emerald-100/40 backdrop-blur dark:border-emerald-900/40 dark:bg-zinc-950/80 dark:shadow-none sm:rounded-[28px] sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                  Flujo guiado
                </div>
                <h2 className="mt-1 break-words text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                  {guidedStepTitle}
                </h2>
                <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500 dark:text-zinc-400">
                  {guidedStepDescription}
                </p>
              </div>
              <div className="w-full rounded-2xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30 sm:w-auto sm:min-w-[150px] sm:p-4">
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{guidedProgress}%</div>
                <div className="text-xs font-bold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                  completado
                </div>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                style={{ width: `${guidedProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Contenido de steps (1,2,3) desacoplado en componentes especializados. */}
        <GuidedTarget id="create-movement-step-content">
        <div className={Movimiento.clsx(
          "mt-4 min-w-0 overflow-hidden border p-3 backdrop-blur-sm transition-colors min-[380px]:p-4 sm:mt-6 sm:p-6",
          guidedMode
            ? "rounded-[28px] border-emerald-100 bg-white/95 shadow-2xl shadow-emerald-100/50 dark:border-emerald-900/40 dark:bg-zinc-950/90 dark:shadow-none"
            : "rounded-2xl border-slate-200/80 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/90 shadow-xl shadow-slate-200/30 dark:shadow-zinc-900/30"
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
                canManageAll={canManageAll}
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
                scheduledTornoMovements={scheduledTornoMovements}
                scheduledTornoLoading={scheduledTornoLoading}
                onRefreshScheduledTorno={refreshScheduledTornoMovements}
                onActivateScheduledTorno={activateScheduledTornoMovement}
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
                sending={sending}
                submit={submit}
                submitLabel={useTornoMedicionStep ? "Confirmar y Continuar al PDF" : undefined}
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
                onEditMedicion={goBackToTornoMedicion}
                onGeneratePdf={generateTornoPdf}
              />
            </GuidedTarget>
          )}
          </div>
        </div>
        </GuidedTarget>

        {/* Navegacion declarativa del wizard. */}
        <div className="mt-5 flex min-w-0 flex-wrap gap-2 sm:gap-3">
          <button
            onClick={clearAction}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.97] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 min-[420px]:flex-none sm:px-4"
          >
            {clearLabel}
          </button>

          {showPreviousButton && !(useTornoMedicionStep && step === 4) && (
            <button
              onClick={guidedGoPrev}
              data-guide-action="create-movement-prev"
              className="min-h-11 flex-1 rounded-xl border border-amber-300 px-3 py-2.5 text-sm font-medium text-amber-700 transition-all hover:bg-amber-50 active:scale-[0.97] dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 min-[420px]:flex-none sm:px-4"
            >
              ← Anterior
            </button>
          )}

          {showNextButton && (
            <GuidedTarget id="create-movement-next-step" className="inline-flex min-w-0 flex-1 min-[420px]:flex-none">
              <button
                onClick={guidedGoNext}
                data-guide-action="create-movement-next"
                className="min-h-11 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/40 active:scale-[0.97] sm:px-5"
              >
                {guidedNextLabel}
              </button>
            </GuidedTarget>
          )}

          {isTornoMeasurementStep && <TornoMeasurementGuideButton steps={tornoGuideSteps} />}
          <button
            onClick={goSalir}
            data-guide-action="create-movement-exit"
            className="min-h-11 flex-1 rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50 active:scale-95 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20 min-[420px]:ml-auto min-[420px]:flex-none sm:px-4"
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
