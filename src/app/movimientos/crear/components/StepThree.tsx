import React, { useState, useMemo } from "react";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { Movimiento } from "../../Movimiento";
import { MovementFormData } from "../../movimientos.shared";
import { inputBase } from "./ui";

type SelectionMode = "de_via" | "para_via";

/**
 * Props del Step 3 (confirmacion y comentarios finales).
 */
type StepThreeProps = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  sending: boolean;
  submit: () => void;
  submitLabel?: string;
  fromSection?: number;
  toSection?: number;
  viaName: (id?: number | null) => string;
  selectionMode: SelectionMode;
};

/**
 * Step 3:
 * - Muestra un resumen legible del movimiento.
 * - Permite agregar comentarios/instrucciones.
 * - Dispara el submit final del controlador.
 */
export default function StepThree({
  form, setForm, sending, submit, submitLabel, fromSection, toSection, viaName, selectionMode,
}: StepThreeProps) {
  const [showAgendadoModal, setShowAgendadoModal] = useState(false);
  const sectionHint = (fromSection ? `[META ORIGEN:${fromSection}] ` : "") + (toSection ? `[META DESTINO:${toSection}]` : "");
  const showHint = Boolean(fromSection || toSection);

  const scheduledDate = useMemo(() => {
    const value = new Date(form.fechaProgramada || "");
    if (!Number.isNaN(value.getTime())) return value;
    return new Date(Date.now() + 60 * 60 * 1000);
  }, [form.fechaProgramada]);

  const formattedScheduledDate = scheduledDate.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSubmitClick = () => {
    if (form.service === "Torno" && form.agendado) {
      setShowAgendadoModal(true);
    } else {
      submit();
    }
  };

  const handleAgendadoConfirm = () => {
    setShowAgendadoModal(false);
    submit();
  };

  return (
    <div className="grid gap-4 relative">
      <GuidedTarget id="create-movement-step3-summary">
      <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-slate-300">
          <li>Localidad: {form.selectedLocalityId ?? "-"}</li>
          {(!form.service || selectionMode === "de_via") && (
            <li>Origen: {form.fromTrack ? `${viaName(form.fromTrack)} ${fromSection ? `(Sección #${fromSection})` : ""}` : "-"}</li>
          )}
          {(!form.service || selectionMode === "para_via") && (
            <li>Destino: {form.toTrack ? `${viaName(form.toTrack)} ${toSection ? `(Sección #${toSection})` : ""}` : "-"}</li>
          )}
          <li>Locomotora: {form.locomotiveNumber || "-"}</li>
          <li>Tipo: {form.movementType || "-"}</li>
          {form.movementType === "REMOLCADA" ? <li>Dirección: {form.direccionEmpuje || "-"}</li> : null}
          {!form.service ? (
            <li>
              Orientación: {form.polo !== "Sin_Solicitar"
                ? `Polo ${form.polo}`
                : form.chimneyPosition !== "Sin_Solicitar"
                  ? `Chimenea ${form.chimneyPosition}`
                  : "-"}
            </li>
          ) : null}
          <li>Prioridad: {form.priority ? "ALTA" : "BAJA"}</li>
          <li>Servicio: {form.service || "Natural"}</li>
        </ul>
      </div>
      </GuidedTarget>

      <GuidedTarget id="create-movement-step3-comments">
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Comentarios / instrucciones</span>
        <textarea
          rows={6}
          className={Movimiento.clsx(inputBase, "min-h[120px] min-h-[120px]")}
          value={form.comments}
          onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))}
          placeholder="Escribe comentarios; agregaremos las secciones seleccionadas automaticamente."
        />
        {showHint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Se anadira: {sectionHint.trim()}</span>}
      </label>
      </GuidedTarget>

      <GuidedTarget id="create-movement-submit" className="inline-flex">
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={sending}
          data-guide-action="create-movement-submit"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          title="Ctrl/Cmd + Enter para enviar"
        >
          {sending ? "Enviando..." : (submitLabel || "Confirmar solicitud")}
        </button>
      </GuidedTarget>

      {showAgendadoModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-4 flex flex-col items-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center">Movimiento Agendado</h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-6 leading-relaxed">
              El movimiento de torno queda agendado para el <strong className="text-slate-900 dark:text-white">{formattedScheduledDate}</strong>.<br/><br/>
              <strong className="text-slate-900 dark:text-white">Si no se activa antes de 10 minutos despues de esa fecha se perdera la calendarizacion.</strong>
            </p>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowAgendadoModal(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgendadoConfirm}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
