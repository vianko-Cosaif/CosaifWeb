'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, TrainFront } from 'lucide-react';

type Movement = {
  id: number;
  estado: string;
  locomotiveNumber: number;
  prioridad: 'BAJA' | 'ALTA';
  tipoMovimiento: 'MD_TRABAJANDO' | 'REMOLCADA' | null;
  instrucciones: string | null;
  posicionChimenea: 'Sin_Solicitar' | 'DENTRO' | 'AFUERA' | null;
  posicionCabina: 'Sin_Solicitar' | 'DENTRO' | 'AFUERA' | null;
  direccionEmpuje: 'Sin_Solicitar' | 'EMPUJAR' | 'JALAR' | null;
  viaOrigenNombreSnapshot?: string | null;
  viaDestinoNombreSnapshot?: string | null;
  seccionOrigenNombreSnapshot?: string | null;
  seccionDestinoNombreSnapshot?: string | null;
};

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || 'No se pudo guardar el movimiento.');
  return payload;
}

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const label = 'block text-sm font-semibold text-slate-700 dark:text-slate-200';

export default function TorreonNaturalEdit({ movimientoId }: { movimientoId: number }) {
  const router = useRouter();
  const [movement, setMovement] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cliente/torreon/movimientos/${movimientoId}/edicion`, { signal: controller.signal, cache: 'no-store' })
      .then(readJson)
      .then((data: Movement) => setMovement(data))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el movimiento.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [movimientoId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movement || saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        locomotiveNumber: Number(movement.locomotiveNumber),
        prioridad: movement.prioridad,
        tipoMovimiento: movement.tipoMovimiento || 'MD_TRABAJANDO',
        instrucciones: movement.instrucciones?.trim() || null,
        posicionChimenea: movement.posicionChimenea || 'Sin_Solicitar',
        posicionCabina: movement.posicionCabina || 'Sin_Solicitar',
        direccionEmpuje: movement.tipoMovimiento === 'REMOLCADA' ? movement.direccionEmpuje || 'Sin_Solicitar' : 'Sin_Solicitar',
      };
      await readJson(await fetch(`/api/cliente/torreon/movimientos/${movimientoId}/edicion`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      }));
      router.push('/cliente/movimientos');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento.');
    } finally { setSaving(false); }
  }

  const editable = movement && ['SOLICITADO', 'ASIGNADO'].includes(movement.estado);
  return (
    <div className="space-y-5">
      <Link href="/cliente/movimientos" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 dark:text-slate-300"><ArrowLeft size={16} /> Volver a movimientos</Link>
      <header className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <span className="rounded-xl bg-emerald-100 p-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><TrainFront size={24} /></span>
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Torreón · Movimiento natural</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Editar movimiento #{movimientoId}</h1></div>
      </header>
      {loading && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950">Cargando movimiento…</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {movement && <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800"><span className="text-sm font-medium text-slate-600 dark:text-slate-300">Estado: <strong>{movement.estado}</strong></span>{!editable && <span className="text-sm text-amber-700 dark:text-amber-300">El movimiento ya inició y es de solo lectura.</span>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Locomotora<input className={field} type="number" min="1" required disabled={!editable || saving} value={movement.locomotiveNumber ?? ''} onChange={(e) => setMovement({ ...movement, locomotiveNumber: Number(e.target.value) })} /></label>
          <label className={label}>Prioridad<select className={field} disabled={!editable || saving} value={movement.prioridad} onChange={(e) => setMovement({ ...movement, prioridad: e.target.value as Movement['prioridad'] })}><option value="BAJA">Normal</option><option value="ALTA">Alta</option></select></label>
          <label className={label}>Tipo de movimiento<select className={field} disabled={!editable || saving} value={movement.tipoMovimiento || 'MD_TRABAJANDO'} onChange={(e) => setMovement({ ...movement, tipoMovimiento: e.target.value as Movement['tipoMovimiento'] })}><option value="MD_TRABAJANDO">Por sus medios</option><option value="REMOLCADA">Remolcada</option></select></label>
          {movement.tipoMovimiento === 'REMOLCADA' && <label className={label}>Dirección de empuje<select className={field} disabled={!editable || saving} value={movement.direccionEmpuje || 'Sin_Solicitar'} onChange={(e) => setMovement({ ...movement, direccionEmpuje: e.target.value as Movement['direccionEmpuje'] })}><option value="Sin_Solicitar">Sin solicitar</option><option value="EMPUJAR">Empujar</option><option value="JALAR">Jalar</option></select></label>}
          <label className={label}>Posición de chimenea<select className={field} disabled={!editable || saving} value={movement.posicionChimenea || 'Sin_Solicitar'} onChange={(e) => setMovement({ ...movement, posicionChimenea: e.target.value as Movement['posicionChimenea'] })}><option value="Sin_Solicitar">Sin solicitar</option><option value="DENTRO">Dentro</option><option value="AFUERA">Afuera</option></select></label>
          <label className={label}>Posición de cabina<select className={field} disabled={!editable || saving} value={movement.posicionCabina || 'Sin_Solicitar'} onChange={(e) => setMovement({ ...movement, posicionCabina: e.target.value as Movement['posicionCabina'] })}><option value="Sin_Solicitar">Sin solicitar</option><option value="DENTRO">Dentro</option><option value="AFUERA">Afuera</option></select></label>
        </div>
        <label className={label}>Instrucciones<textarea className={`${field} min-h-28 resize-y`} maxLength={2000} disabled={!editable || saving} value={movement.instrucciones || ''} onChange={(e) => setMovement({ ...movement, instrucciones: e.target.value })} /></label>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300"><p className="font-semibold text-slate-800 dark:text-slate-100">Recorrido asignado</p><p className="mt-1">{[movement.viaOrigenNombreSnapshot, movement.seccionOrigenNombreSnapshot].filter(Boolean).join(' / ') || 'Origen sin especificar'} → {[movement.viaDestinoNombreSnapshot, movement.seccionDestinoNombreSnapshot].filter(Boolean).join(' / ') || 'Destino sin especificar'}</p></div>
        {editable && <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"><Save size={17} />{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>}
      </form>}
    </div>
  );
}
