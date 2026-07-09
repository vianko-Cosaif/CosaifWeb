import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { buildArrastreFolio, fmtDate, getArrastreTimeline, type Arrastre, type DailyInfo, type VagonArrastre } from "@/features/torreon/arrastres";
import { isArrastreEditable, statusText } from "../../utils";
import { EstadoBadge } from "../EstadoBadge";
import { canMoveWithNeighbor, Direction, getCurrentVagon, orderedVagones, vagonLabel } from "./helpers";
import { IconButton, TerminalInfo } from "./TerminalControls";

type Props = {
  arrastre: Arrastre;
  dailyInfo?: DailyInfo;
  busyAction: string | null;
  onEditVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onReorderVagon?: (arrastre: Arrastre, vagon: VagonArrastre, direction: Direction) => void;
};

export function RondaDetail({ arrastre, dailyInfo, busyAction, onEditVagon, onReorderVagon }: Props) {
  const vagones = orderedVagones(arrastre);
  const current = getCurrentVagon(arrastre);
  const timeline = getArrastreTimeline(arrastre);
  const canChange = isArrastreEditable(arrastre.estado);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-3 border-b border-slate-100 p-3 dark:border-slate-800 md:grid-cols-[1.1fr_1fr_1fr_1fr]">
        <TerminalInfo label="Conjunto" value={buildArrastreFolio(arrastre, dailyInfo)} />
        <TerminalInfo label="Vagon actual" value={vagonLabel(current)} />
        <TerminalInfo label="Inicio" value={fmtDate(timeline.inicio)} />
        <TerminalInfo label="Fin" value={fmtDate(timeline.fin)} />
      </div>
      {arrastre.instrucciones && (
        <div className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Instrucciones</span>
          <p className="mt-1">{arrastre.instrucciones}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="w-20 px-3 py-3">Orden</th>
              <th className="px-3 py-3">Vagon</th>
              <th className="px-3 py-3">Carga</th>
              <th className="px-3 py-3">Zona</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Inicio</th>
              <th className="px-3 py-3">Fin</th>
              <th className="w-32 px-3 py-3 text-right">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {vagones.map((vagon, index) => {
              const vagonEnProceso = statusText(vagon.estado) === "EN_PROCESO";
              const vagonConcluido = statusText(vagon.estado) === "CONCLUIDO";
              const canMoveUp = canChange && canMoveWithNeighbor(vagones, index, "up");
              const canMoveDown = canChange && canMoveWithNeighbor(vagones, index, "down");
              const canEdit = canChange && !vagonEnProceso && !vagonConcluido;

              return (
                <tr key={vagon.id} className={vagon.id === current?.id ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-white dark:bg-slate-950"}>
                  <td className="px-3 py-3 font-mono text-base font-black text-slate-950 dark:text-white">{vagon.orden}</td>
                  <td className="px-3 py-3">
                    <div className="font-black text-slate-900 dark:text-slate-100">{vagonLabel(vagon)}</div>
                    {vagon.id === current?.id && <div className="mt-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">En tablero</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md border border-slate-200 px-2 py-1 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">{statusText(vagon.carga)}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300">Via {vagon.viaId ?? "-"} / Seccion {vagon.seccionId ?? "-"}</td>
                  <td className="px-3 py-3"><EstadoBadge estado={vagon.estado} /></td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{fmtDate(vagon.fechaInicio)}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{fmtDate(vagon.fechaFin)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {onReorderVagon && (
                        <>
                          <IconButton title="Subir vagon" disabled={!canMoveUp || busyAction != null} onClick={() => onReorderVagon(arrastre, vagon, "up")}>
                            <ArrowUp className="h-4 w-4" />
                          </IconButton>
                          <IconButton title="Bajar vagon" disabled={!canMoveDown || busyAction != null} onClick={() => onReorderVagon(arrastre, vagon, "down")}>
                            <ArrowDown className="h-4 w-4" />
                          </IconButton>
                        </>
                      )}
                      {onEditVagon && (
                        <IconButton title="Editar vagon" disabled={!canEdit || busyAction != null} onClick={() => onEditVagon(arrastre, vagon)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
