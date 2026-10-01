'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bookmark, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import { currentStorageScope } from '@/lib/auth/storageScope';
import type { Ambito, FiltrosMovimientos } from './useMovimientos';
import { parseMovementView, type MovementView } from './views';

type SavedView = { id: string; name: string; view: MovementView };
export default function SavedViews({ filtros, ambito, onApply }: {
  filtros: FiltrosMovimientos; ambito: Ambito; onApply: (view: MovementView) => void;
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);
  const key = owner ? `cosaif:movement-views:${owner}` : null;
  useEffect(() => {
    const sync = () => setOwner(currentStorageScope());
    sync(); window.addEventListener('storage', sync); window.addEventListener('cosaif:session-ended', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('cosaif:session-ended', sync); };
  }, []);
  const applyRef = useRef(onApply);
  useEffect(() => { applyRef.current = onApply; }, [onApply]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const apply = useCallback((view: MovementView) => { applyRef.current(view); }, []);
  useEffect(() => {
    setHydrated(false); setViews([]); setSelected('');
    if (!key) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) setViews(saved.slice(0, 15).flatMap(item => {
        const view = parseMovementView(JSON.stringify(item?.view));
        return view && typeof item.id === 'string' && typeof item.name === 'string' ? [{ id: item.id, name: item.name.slice(0, 40), view }] : [];
      }));
      const view = parseMovementView(new URLSearchParams(window.location.search).get('vista') || sessionStorage.getItem(`${key}:last`));
      if (view) apply(view);
    } catch { setMessage('No se pudieron recuperar las vistas de este dispositivo.'); }
    setHydrated(true);
  }, [key, apply]);
  useEffect(() => {
    if (!hydrated || !key) return;
    const timer = setTimeout(() => {
      const value = JSON.stringify({ ambito, filtros });
      try { sessionStorage.setItem(`${key}:last`, value); } catch { /* Keep URL state available. */ }
      const url = new URL(window.location.href); url.searchParams.set('vista', value);
      window.history.replaceState(window.history.state, '', url);
    }, 300);
    return () => clearTimeout(timer);
  }, [ambito, filtros, hydrated, key]);
  useEffect(() => {
    const pop = () => { const view = parseMovementView(new URLSearchParams(window.location.search).get('vista')); if (view) apply(view); };
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, [apply]);
  function persist(next: SavedView[]) {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(next)); setViews(next); setMessage('Vistas guardadas en este dispositivo.'); }
    catch { setMessage('No se pudo guardar la vista.'); }
  }
  return <section aria-label="Consultas guardadas" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]">
    <button
      type="button"
      aria-label={expanded ? 'Ocultar vistas guardadas' : 'Mostrar vistas guardadas'}
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={() => setExpanded(value => !value)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
    >
      <span className="inline-flex min-w-0 items-center gap-2"><Bookmark size={15} className="shrink-0" aria-hidden /><span>Vistas guardadas{views.length ? ` (${views.length})` : ''}</span></span>
      <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
    </button>
    <div id={panelId} hidden={!expanded}>
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--app-border)] p-3">
    <select aria-label="Vistas guardadas" value={selected} className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base sm:w-auto sm:text-sm" onChange={event => { setSelected(event.target.value); const saved = views.find(item => item.id === event.target.value); if (saved) apply(saved.view); }}>
      <option value="">Vistas guardadas</option>{views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
    </select>
    <input aria-label="Nombre de la vista" placeholder="Nombre de esta consulta" maxLength={40} value={name} onChange={event => setName(event.target.value)} className="min-h-11 min-w-0 max-w-full flex-1 basis-48 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base sm:text-sm"/>
    <Button disabled={!name.trim() || !key || views.length >= 15} onClick={() => { persist([...views, { id: crypto.randomUUID(), name: name.trim(), view: { ambito, filtros } }]); setName(''); }}>Guardar vista</Button>
    {selected ? <Button onClick={() => { persist(views.filter(item => item.id !== selected)); setSelected(''); }}>Quitar vista</Button> : null}
    <Button onClick={async () => { const url = new URL(window.location.href); url.searchParams.set('vista', JSON.stringify({ ambito, filtros })); try { await navigator.clipboard.writeText(url.href); setMessage('Enlace copiado. Cada cuenta verá únicamente los datos que tenga autorizados.'); } catch { setMessage('Copia el enlace desde la barra de direcciones.'); } }}>Copiar enlace</Button>
    <span className="w-full text-xs text-[var(--app-text-muted)]">Al volver del detalle se conserva tu consulta. Hasta 15 vistas por cuenta.</span>
    </div>
    </div>
    {message ? <p role="status" className="px-3 pb-3 text-xs text-[var(--app-text-muted)]">{message}</p> : null}
  </section>;
}
