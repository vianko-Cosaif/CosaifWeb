import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, TrainFront } from "lucide-react";
import { Header } from "../components";
import { fieldClass } from "../utils";
import type { CargaVagon, VagonDraft } from "../types";

type Props = {
  feedback: ReactNode;
  refreshing: boolean;
  instrucciones: string;
  draftVagones: VagonDraft[];
  draftCapacity: number;
  busyAction: string | null;
  onRefresh: () => void;
  onGoMovimientos: () => void;
  onInstruccionesChange: (value: string) => void;
  onUpdateVagon: (tempId: number, patch: Partial<VagonDraft>) => void;
  onRemoveVagon: (tempId: number) => void;
  onMoveVagon: (tempId: number, direction: "up" | "down") => void;
  onAddVagon: () => void;
  onSubmit: () => void;
};

export function CrearView({
  feedback,
  refreshing,
  instrucciones,
  draftVagones,
  draftCapacity,
  busyAction,
  onRefresh,
  onGoMovimientos,
  onInstruccionesChange,
  onUpdateVagon,
  onRemoveVagon,
  onMoveVagon,
  onAddVagon,
  onSubmit,
}: Props) {
  return (
    <>
      <Header
        title="Crear movimiento"
        subtitle="Torreon arrastres"
        refreshing={refreshing}
        onRefresh={onRefresh}
        action={(
          <button type="button" onClick={onGoMovimientos} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm">
            <TrainFront className="h-4 w-4" />
            Movimientos
          </button>
        )}
      />
      {feedback}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Instrucciones</label>
            <textarea
              value={instrucciones}
              onChange={(event) => onInstruccionesChange(event.target.value)}
              className="min-h-[88px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Notas del arrastre"
            />
          </div>

          <div className="grid gap-3">
            {draftVagones.map((vagon, index) => (
              <VagonDraftRow
                key={vagon.tempId}
                vagon={vagon}
                index={index}
                disableRemove={draftVagones.length === 1}
                canMoveUp={index > 0}
                canMoveDown={index < draftVagones.length - 1}
                onUpdate={onUpdateVagon}
                onRemove={onRemoveVagon}
                onMove={onMoveVagon}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`text-sm font-semibold ${draftCapacity > 8 ? "text-rose-700" : "text-slate-600"}`}>
              Capacidad {draftCapacity}/8
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onAddVagon} disabled={draftVagones.length >= 8} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Vagon
              </button>
              <button type="button" onClick={onSubmit} disabled={busyAction === "crear" || draftCapacity > 8} className="inline-flex h-10 min-w-[170px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                {busyAction === "crear" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear movimiento"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function VagonDraftRow({
  vagon,
  index,
  disableRemove,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMove,
}: {
  vagon: VagonDraft;
  index: number;
  disableRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (tempId: number, patch: Partial<VagonDraft>) => void;
  onRemove: (tempId: number) => void;
  onMove: (tempId: number, direction: "up" | "down") => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[88px_1fr_150px_120px_120px_auto] lg:items-end">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Orden</label>
        <div className="flex items-center gap-1">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-800">{index + 1}</span>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(vagon.tempId, "up")}
              className="inline-flex h-[18px] w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Subir vagon"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(vagon.tempId, "down")}
              className="inline-flex h-[18px] w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Bajar vagon"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Vagon {index + 1}</label>
        <input value={vagon.numeroVagon} onChange={(event) => onUpdate(vagon.tempId, { numeroVagon: event.target.value })} className={fieldClass()} placeholder="Numero" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Carga</label>
        <select value={vagon.carga} onChange={(event) => onUpdate(vagon.tempId, { carga: event.target.value as CargaVagon })} className={fieldClass()}>
          <option value="VACIO">Vacio</option>
          <option value="LLENO">Lleno</option>
        </select>
      </div>
      <DraftInput label="Via" value={vagon.viaId} onChange={(value) => onUpdate(vagon.tempId, { viaId: value })} />
      <DraftInput label="Seccion" value={vagon.seccionId} onChange={(value) => onUpdate(vagon.tempId, { seccionId: value })} />
      <button type="button" onClick={() => onRemove(vagon.tempId)} disabled={disableRemove} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
        Quitar
      </button>
    </div>
  );
}

function DraftInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()} inputMode="numeric" placeholder={label} />
    </div>
  );
}
