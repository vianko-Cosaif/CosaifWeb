import { Loader2 } from "lucide-react";
import type { CargaVagon, EditVagonDraft } from "../types";
import { fieldClass } from "../utils";

type Props = {
  draft: EditVagonDraft;
  busy: boolean;
  onChange: (patch: Partial<EditVagonDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function EditVagonModal({ draft, busy, onChange, onClose, onSubmit }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-6">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Arrastre #{draft.arrastreId}</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Editar vagon</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">
            Cerrar
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <EditField label="Numero" value={draft.numeroVagon} onChange={(value) => onChange({ numeroVagon: value })} placeholder="Numero de vagon" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Carga</label>
            <select value={draft.carga} onChange={(event) => onChange({ carga: event.target.value as CargaVagon })} className={fieldClass()}>
              <option value="VACIO">Vacio</option>
              <option value="LLENO">Lleno</option>
            </select>
          </div>
          <EditField label="Via" value={draft.viaId} onChange={(value) => onChange({ viaId: value })} placeholder="Via" numeric />
          <EditField label="Seccion" value={draft.seccionId} onChange={(value) => onChange({ seccionId: value })} placeholder="Seccion" numeric />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onSubmit} disabled={busy} className="inline-flex h-10 min-w-[150px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange, placeholder, numeric }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; numeric?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()} inputMode={numeric ? "numeric" : undefined} placeholder={placeholder} />
    </div>
  );
}
