"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Settings2,
  Undo2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchCatalogSummary, saveOperationalLocation } from "./api";
import { CatalogConfirmDialog } from "./components/CatalogConfirmDialog";
import { CatalogLocationList } from "./components/CatalogLocationList";
import { CatalogTrackEditor } from "./components/CatalogTrackEditor";
import type { CatalogLocation, CatalogSummary, CatalogWarning, TrackDraft } from "./types";

const inputClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100";
const labelClass =
  "text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500";
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";

type PendingSwitch =
  | { kind: "new" }
  | { kind: "location"; location: CatalogLocation };

function makeTracks(start: number, end: number, secciones: number): TrackDraft[] {
  const safeStart = Math.max(1, Math.min(start, end));
  const safeEnd = Math.max(safeStart, end);
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => {
    const numero = safeStart + index;
    return { numero, nombre: `Vía ${numero}`, secciones };
  });
}

function tracksFromLocation(location: CatalogLocation): TrackDraft[] {
  return location.vias.map((via) => {
    const occupiedSections = via.secciones.filter((section) => section.ocupada || section.movimientoId != null);
    const minimumSections = occupiedSections.reduce((max, section) => Math.max(max, section.numero), 0);
    return {
      id: via.id,
      numero: via.numero,
      nombre: via.nombre,
      secciones: via.secciones.length,
      minimumSections,
      occupiedSections: occupiedSections.length,
    };
  });
}

function comparableTracks(tracks: TrackDraft[]) {
  return tracks
    .map((track) => ({
      id: track.id ?? null,
      numero: Number(track.numero),
      nombre: track.nombre.trim(),
      secciones: Number(track.secciones),
    }))
    .sort((a, b) => a.numero - b.numero);
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function validateTracks(tracks: TrackDraft[]) {
  if (!tracks.length) return "Agrega al menos una vía.";

  const numbers = new Set<number>();
  const names = new Set<string>();
  for (const track of tracks) {
    const numero = Number(track.numero);
    const sections = Number(track.secciones);
    const name = track.nombre.trim().toLocaleLowerCase("es-MX");

    if (!Number.isInteger(numero) || numero <= 0) return "Cada vía necesita un número entero mayor a cero.";
    if (!name) return `Captura el nombre de la vía ${numero}.`;
    if (numbers.has(numero)) return `El número de vía ${numero} está repetido.`;
    if (names.has(name)) return `El nombre “${track.nombre.trim()}” está repetido.`;
    if (!Number.isInteger(sections) || sections < 0) return `La vía ${numero} tiene una cantidad de secciones inválida.`;
    if (sections < (track.minimumSections ?? 0)) {
      return `La vía ${numero} debe conservar al menos ${track.minimumSections} secciones porque tiene operación activa.`;
    }

    numbers.add(numero);
    names.add(name);
  }
  return null;
}

export default function CatalogosOperativosPageClient() {
  const [summary, setSummary] = useState<CatalogSummary>({ localidades: [], warnings: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [operationWarnings, setOperationWarnings] = useState<CatalogWarning[]>([]);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState("ACTIVA");
  const [inicio, setInicio] = useState(1);
  const [fin, setFin] = useState(30);
  const [seccionesPorVia, setSeccionesPorVia] = useState(3);
  const [cantidadNavajas, setCantidadNavajas] = useState(0);
  const [tracks, setTracks] = useState<TrackDraft[]>(() => makeTracks(1, 30, 3));
  const [removedTracks, setRemovedTracks] = useState<TrackDraft[]>([]);
  const [pendingRemovalIndex, setPendingRemovalIndex] = useState<number | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  const selectedLocation = useMemo(
    () => summary.localidades.find((location) => location.id === selectedId) ?? null,
    [selectedId, summary.localidades],
  );

  const totals = useMemo(() => summary.localidades.reduce(
    (acc, location) => ({
      localidades: acc.localidades + 1,
      vias: acc.vias + location.totalVias,
      secciones: acc.secciones + location.totalSecciones,
      torno: acc.torno + (location.torno.configurado ? 1 : 0),
    }),
    { localidades: 0, vias: 0, secciones: 0, torno: 0 },
  ), [summary.localidades]);

  const kpis: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Localidades", value: totals.localidades, icon: MapPin },
    { label: "Vías", value: totals.vias, icon: Route },
    { label: "Secciones", value: totals.secciones, icon: Settings2 },
    { label: "Torno configurado", value: totals.torno, icon: Wrench },
  ];

  const hasChanges = useMemo(() => {
    if (removedTracks.length) return true;
    if (selectedLocation) {
      return nombre.trim() !== selectedLocation.nombre ||
        estado !== selectedLocation.estado ||
        cantidadNavajas !== selectedLocation.torno.cantidadNavajas ||
        JSON.stringify(comparableTracks(tracks)) !== JSON.stringify(comparableTracks(tracksFromLocation(selectedLocation)));
    }
    return nombre.trim().length > 0 || estado !== "ACTIVA" || cantidadNavajas !== 0 ||
      JSON.stringify(comparableTracks(tracks)) !== JSON.stringify(comparableTracks(makeTracks(1, 30, 3)));
  }, [cantidadNavajas, estado, nombre, removedTracks.length, selectedLocation, tracks]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCatalogSummary();
      setSummary(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la configuración.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForNew() {
    setSelectedId(null);
    setNombre("");
    setEstado("ACTIVA");
    setCantidadNavajas(0);
    setInicio(1);
    setFin(30);
    setSeccionesPorVia(3);
    setTracks(makeTracks(1, 30, 3));
    setRemovedTracks([]);
    setOperationWarnings([]);
    setNotice(null);
    setError(null);
  }

  function loadLocation(location: CatalogLocation, editingNotice = true) {
    setSelectedId(location.id);
    setNombre(location.nombre);
    setEstado(location.estado || "ACTIVA");
    setCantidadNavajas(location.torno.cantidadNavajas || 0);
    setTracks(tracksFromLocation(location));
    setRemovedTracks([]);
    setOperationWarnings([]);
    setNotice(editingNotice ? `Editando ${location.nombre}` : null);
    setError(null);
  }

  function requestLocation(location: CatalogLocation) {
    if (selectedId === location.id) return;
    if (hasChanges) setPendingSwitch({ kind: "location", location });
    else loadLocation(location);
  }

  function requestNew() {
    if (hasChanges) setPendingSwitch({ kind: "new" });
    else resetForNew();
  }

  function confirmSwitch() {
    if (!pendingSwitch) return;
    if (pendingSwitch.kind === "new") resetForNew();
    else loadLocation(pendingSwitch.location);
    setPendingSwitch(null);
  }

  function generateTracks(nextStart = inicio, nextEnd = fin, nextSections = seccionesPorVia) {
    if (selectedLocation && hasChanges) {
      setError("La generación reemplaza la lista actual. Guarda o descarta los cambios antes de usar una plantilla.");
      return;
    }
    setTracks(makeTracks(nextStart, nextEnd, Math.max(0, nextSections)));
    setRemovedTracks([]);
  }

  function updateTrack(index: number, patch: Partial<TrackDraft>) {
    setTracks((current) => current.map((track, i) => i === index ? { ...track, ...patch } : track));
    setNotice(null);
  }

  function addTrack() {
    const nextNumber = tracks.reduce((max, track) => Math.max(max, Number(track.numero) || 0), 0) + 1;
    setTracks((current) => [...current, { numero: nextNumber, nombre: `Vía ${nextNumber}`, secciones: seccionesPorVia }]);
    setNotice(null);
  }

  function requestRemoveTrack(index: number) {
    if (tracks.length <= 1) {
      setError("Cada localidad debe conservar al menos una vía.");
      return;
    }
    if (tracks[index]?.id) setPendingRemovalIndex(index);
    else setTracks((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function confirmRemoveTrack() {
    if (pendingRemovalIndex == null) return;
    const track = tracks[pendingRemovalIndex];
    if (track) {
      setRemovedTracks((current) => [...current, track]);
      setTracks((current) => current.filter((_, index) => index !== pendingRemovalIndex));
    }
    setPendingRemovalIndex(null);
  }

  function undoRemovedTracks() {
    setTracks((current) => [...current, ...removedTracks].sort((a, b) => a.numero - b.numero));
    setRemovedTracks([]);
    setNotice("Eliminación cancelada");
  }

  async function submit() {
    const cleanName = nombre.trim();
    if (!cleanName) {
      setError("El nombre de la localidad es obligatorio.");
      return;
    }
    const trackError = validateTracks(tracks);
    if (trackError) {
      setError(trackError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    setOperationWarnings([]);
    try {
      const result = await saveOperationalLocation({
        localidad: { ...(selectedId ? { id: selectedId } : {}), nombre: cleanName, estado },
        vias: tracks.map((track) => ({
          ...(track.id ? { id: track.id } : {}),
          numero: Number(track.numero),
          nombre: track.nombre.trim(),
          secciones: Number(track.secciones),
        })),
        viasEliminadas: removedTracks.flatMap((track) => track.id ? [track.id] : []),
        torno: {
          configurar: cantidadNavajas > 0,
          cantidadNavajas: Math.max(0, Number(cantidadNavajas) || 0),
        },
      });

      const refreshed = await fetchCatalogSummary();
      setSummary(refreshed);
      const savedLocation = refreshed.localidades.find((location) => location.id === result.localidad.id);
      if (savedLocation) loadLocation(savedLocation, false);
      setOperationWarnings(result.warnings || []);
      setNotice(selectedId ? "Cambios guardados correctamente" : "Localidad creada correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  const pendingTrack = pendingRemovalIndex == null ? null : tracks[pendingRemovalIndex] ?? null;
  const allWarnings = [...operationWarnings, ...summary.warnings];

  return (
    <div className="min-h-svh bg-slate-50 px-3 py-5 text-slate-950 dark:bg-neutral-950 dark:text-zinc-50 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Catálogo natural</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Patios de movimientos naturales</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600 dark:text-zinc-400">
                Administra localidades, vías, secciones y Torno para movimientos naturales de Guadalajara y Torreón.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${buttonBase} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`} onClick={() => void load()} disabled={loading || saving}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
              </button>
              <button type="button" className={`${buttonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`} onClick={requestNew} disabled={saving}>
                <Plus className="h-4 w-4" /> Nueva localidad
              </button>
            </div>
          </div>
        </header>

        <section aria-label="Resumen de catálogos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between"><p className={labelClass}>{label}</p><Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        {(error || notice || allWarnings.length > 0) ? (
          <div className="space-y-2" aria-live="polite">
            {error ? <Message tone="error" text={error} /> : null}
            {notice ? <Message tone="success" text={notice} /> : null}
            {allWarnings.map((warning, index) => <Message key={`${warning.scope}-${index}`} tone="warning" text={warning.message} />)}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.35fr)]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-black">Localidades existentes</h2>
              <label className="relative mt-3 block">
                <span className="sr-only">Buscar localidad</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${inputClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o estado…" />
              </label>
            </div>
            <CatalogLocationList locations={summary.localidades} selectedId={selectedId} query={query} loading={loading} onSelect={requestLocation} />
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">{selectedLocation ? `Editar ${selectedLocation.nombre}` : "Nueva localidad operativa"}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-zinc-500">Los cambios se aplican al presionar Guardar.</p>
              </div>
              {hasChanges ? <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Cambios sin guardar</span> : null}
            </div>

            <div className="space-y-6 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <Field label="Localidad"><input className={`${inputClass} w-full`} value={nombre} onChange={(event) => { setNombre(event.target.value); setNotice(null); }} placeholder="Guadalajara, Torreón…" maxLength={80} /></Field>
                <Field label="Estado"><select className={`${inputClass} w-full`} value={estado} onChange={(event) => { setEstado(event.target.value); setNotice(null); }}><option value="ACTIVA">ACTIVA</option><option value="INACTIVA">INACTIVA</option><option value="MANTENIMIENTO">MANTENIMIENTO</option></select></Field>
                <Field label="Navajas Torno"><input className={`${inputClass} w-full`} type="number" min={0} max={500} value={cantidadNavajas} onChange={(event) => { setCantidadNavajas(Number(event.target.value)); setNotice(null); }} /></Field>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                  <Field label="Vía inicio"><input className={`${inputClass} w-full`} type="number" min={1} value={inicio} onChange={(event) => setInicio(Number(event.target.value))} /></Field>
                  <Field label="Vía fin"><input className={`${inputClass} w-full`} type="number" min={1} value={fin} onChange={(event) => setFin(Number(event.target.value))} /></Field>
                  <Field label="Secciones por vía"><input className={`${inputClass} w-full`} type="number" min={0} value={seccionesPorVia} onChange={(event) => setSeccionesPorVia(Number(event.target.value))} /></Field>
                  <button type="button" className={`${buttonBase} border-slate-200 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950`} onClick={() => generateTracks()}><Settings2 className="h-4 w-4" /> Generar</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={`${buttonBase} min-h-9 bg-white py-1 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`} onClick={() => { setInicio(1); setFin(30); setSeccionesPorVia(3); generateTracks(1, 30, 3); }}>Plantilla 30 vías / 3 secciones</button>
                  <button type="button" className={`${buttonBase} min-h-9 bg-white py-1 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`} onClick={addTrack}><Plus className="h-3.5 w-3.5" /> Agregar vía</button>
                </div>
              </div>

              {removedTracks.length ? (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                  <span>{formatCount(removedTracks.length, "vía se eliminará", "vías se eliminarán")} al guardar.</span>
                  <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 px-3" onClick={undoRemovedTracks}><Undo2 className="h-4 w-4" /> Deshacer</button>
                </div>
              ) : null}

              <CatalogTrackEditor tracks={tracks} inputClassName={inputClass} onChange={updateTrack} onRemove={requestRemoveTrack} />

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{formatCount(tracks.length, "vía", "vías")} · {formatCount(tracks.reduce((total, track) => total + Math.max(0, Number(track.secciones) || 0), 0), "sección", "secciones")}</p>
                <div className="flex flex-wrap gap-2">
                  {hasChanges ? <button type="button" className={`${buttonBase} border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`} onClick={() => selectedLocation ? loadLocation(selectedLocation) : resetForNew()} disabled={saving}>Descartar</button> : null}
                  <button type="button" className={`${buttonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`} onClick={() => void submit()} disabled={saving || !hasChanges}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {selectedId ? "Guardar cambios" : "Crear localidad"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      <CatalogConfirmDialog
        open={pendingRemovalIndex != null}
        title={`Quitar ${pendingTrack?.nombre || "vía"}`}
        description="La vía se eliminará al guardar. El backend rechazará la operación si existen movimientos relacionados."
        confirmLabel="Quitar vía"
        tone="danger"
        onCancel={() => setPendingRemovalIndex(null)}
        onConfirm={confirmRemoveTrack}
      />
      <CatalogConfirmDialog
        open={pendingSwitch != null}
        title="Descartar cambios sin guardar"
        description="Los cambios realizados en la localidad actual se perderán."
        confirmLabel="Descartar y continuar"
        onCancel={() => setPendingSwitch(null)}
        onConfirm={confirmSwitch}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-2"><span className={labelClass}>{label}</span>{children}</label>;
}

function Message({ tone, text }: { tone: "error" | "success" | "warning"; text: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  const classes = tone === "error"
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
    : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";
  return <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-3 text-sm font-bold ${classes}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" />{text}</div>;
}
