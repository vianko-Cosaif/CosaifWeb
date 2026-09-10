'use client';
import type { Movement } from './useMovimientos';
export default function AttentionSummary({ rows, onState }: { rows: Movement[]; onState: (state: string) => void }) {
  const stopped = rows.filter(row => row.estado === 'DETENIDO');
  const requested = rows.filter(row => row.estado === 'SOLICITADO');
  const unassigned = rows.filter(row => !row.finalizado && !row.operadorId && !row.maquinistaId);
  return <div className="space-y-2">
    <p className="text-xs font-medium text-[var(--app-text-muted)]">Atención del turno · registros de esta página</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <button type="button" onClick={() => onState('DETENIDO')} className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-left text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100"><strong className="text-xl">{stopped.length}</strong><span className="ml-2">Detenidos</span><span className="block text-xs">Ver movimientos que requieren atención</span></button>
      <button type="button" onClick={() => onState('SOLICITADO')} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"><strong className="text-xl">{requested.length}</strong><span className="ml-2">Por iniciar</span><span className="block text-xs">Consultar solicitudes pendientes</span></button>
      <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3"><strong className="text-xl">{unassigned.length}</strong><span className="ml-2">Sin operador asignado</span><p className="text-xs text-[var(--app-text-muted)]">Revisar la asignación en rondas</p></div>
    </div>
  </div>;
}
