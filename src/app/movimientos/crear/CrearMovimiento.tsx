"use client";

import React, { useEffect } from "react";
import { useMounted } from "@/app/hooks/useMounted";
import { getInitialTheme, applyTheme, onThemeChange } from "@/lib/theme";
import { Movimiento } from "../Movimiento";
import StepOne from "./components/StepOne";
import StepTwo from "./components/StepTwo";
import StepTwoTorno from "./components/StepTwoTorno";
import StepThree from "./components/StepThree";
import StepFourTorno from "./components/StepFourTorno";
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
    clearOutbox,
  } = useCrearMovimientoController();

  if (!mounted) return null;

  const useTornoMedicionStep = hasTornoPdfStep;
  const stepNames = useTornoMedicionStep
    ? (["Datos", "Medicion", "Confirmar", "PDF"] as const)
    : (["Datos", "Detalles", "Confirmar"] as const);
  const title = useTornoMedicionStep && step === 2 ? "Medicion de Ruedas" : "Nuevo Movimiento";
  const pageTitle = useTornoMedicionStep && step === 4 ? "Resumen de Medidas" : title;
  const nextLabel =
    useTornoMedicionStep && step === 2
      ? (tornoStep2Completed && tornoMovimientoId !== null ? "Volver al PDF →" : "Guardar y Continuar →")
      : "Siguiente →";
  const selectedCompanyName =
    empresas.find((empresa) => empresa.id === form.empresaId)?.nombre ||
    userCompanyName ||
    "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-zinc-950 dark:to-zinc-900 text-slate-900 dark:text-white transition-colors duration-200 p-4 md:p-6 lg:p-8">
      <style jsx global>{`
        @media (max-width: 640px) {
          select, select option { font-size: 16px !important; line-height: 1.45 !important; }
          select { min-height: 48px !important; }
        }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.05]"
      />
      <div className={Movimiento.clsx("relative z-10 mx-auto", useTornoMedicionStep ? "max-w-7xl" : "max-w-4xl")}>

        <div className="mb-4 flex flex-wrap items-center gap-2">
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
          <button onClick={goSalir} className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95" title="Volver a mis movimientos">
            Salir
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
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
        <div className="mt-5 flex items-center justify-center gap-0" aria-label="Progreso">
          {stepNames.map((stepName, i) => {
            const s = i + 1;
            return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
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
                  "text-[10px] font-semibold transition-colors",
                  s <= step ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"
                )}>
                  {stepName}
                </span>
              </div>
              {i < stepNames.length - 1 && (
                <div className="flex-1 mx-2 mb-4">
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

        {/* Contenido de steps (1,2,3) desacoplado en componentes especializados. */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-sm p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-zinc-900/30">
          {step === 1 && (
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
            />
          )}
          {step === 2 && !useTornoMedicionStep && <StepTwo form={form} setForm={setForm} errors={errors} isService={isService} />}
          {step === 2 && useTornoMedicionStep && (
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
          {step === 3 && (
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
          )}
          {step === 4 && useTornoMedicionStep && (
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
          )}
        </div>

        {/* Navegacion declarativa del wizard. */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={clearForm}
            className="rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all active:scale-[0.97]"
          >
            Limpiar
          </button>

          {step > 1 && !(useTornoMedicionStep && step === 4) && (
            <button onClick={goPrev} className="rounded-xl border border-amber-300 dark:border-amber-700 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-[0.97]">
              ← Anterior
            </button>
          )}

          {step < 3 && (
            <button
              onClick={goNext}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-[0.97]"
            >
              {nextLabel}
            </button>
          )}

          <button onClick={goSalir} className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95" title="Volver a mis movimientos">
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
