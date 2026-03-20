import React from "react";
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
  const sectionHint = (fromSection ? `[META ORIGEN:${fromSection}] ` : "") + (toSection ? `[META DESTINO:${toSection}]` : "");
  const showHint = Boolean(fromSection || toSection);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-slate-300">
          <li>Localidad: {form.selectedLocalityId ?? "-"}</li>
          {selectionMode === "de_via" && (
            <li>Origen: {form.fromTrack ? `Via ${viaName(form.fromTrack)} ${fromSection ? `(Seccion #${fromSection})` : ""}` : "-"}</li>
          )}
          {selectionMode === "para_via" && (
            <li>Destino: {form.toTrack ? `Via ${viaName(form.toTrack)} ${toSection ? `(Seccion #${toSection})` : ""}` : "-"}</li>
          )}
          <li>Locomotora: {form.locomotiveNumber || "-"}</li>
          <li>Tipo: {form.movementType || "-"}</li>
          <li>Direccion: {form.direccionEmpuje || "-"}</li>
          <li>Prioridad: {form.priority ? "ALTA" : "BAJA"}</li>
          <li>Servicio: {form.service || "-"}</li>
        </ul>
      </div>

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

      <button onClick={submit} disabled={sending} className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" title="Ctrl/Cmd + Enter para enviar">
        {sending ? "Enviando..." : (submitLabel || "Confirmar solicitud")}
      </button>
    </div>
  );
}
