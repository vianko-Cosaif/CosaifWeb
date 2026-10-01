"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw, Save, TrainFront, Trash2 } from "lucide-react";
import { getPrimaryTorreonLocalidadId } from "@/lib/torreonLocalidad";

type YardSection = { id?: number; numero: number; nombre: string };
type YardTrack = { id?: number; numero: number; nombre: string; secciones: YardSection[] };

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";

function makeSections(count: number): YardSection[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({ numero: index + 1, nombre: `Sección ${index + 1}` }));
}

function makeTracks(start: number, end: number, sectionCount: number): YardTrack[] {
  const safeStart = Math.max(1, Math.min(start, end));
  const safeEnd = Math.max(safeStart, end);
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => {
    const numero = safeStart + index;
    return { numero, nombre: `Vía Arrastre ${numero}`, secciones: makeSections(sectionCount) };
  });
}

function readTracks(payload: unknown): YardTrack[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)
      ? (payload as { data: unknown[] }).data
      : [];
  return source.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const sections = Array.isArray(record.secciones) ? record.secciones : [];
    return {
      id: Number(record.id) || undefined,
      numero: Number(record.numero) || 0,
      nombre: String(record.nombre || ""),
      secciones: sections.map((section) => {
        const row = section && typeof section === "object" ? section as Record<string, unknown> : {};
        return { id: Number(row.id) || undefined, numero: Number(row.numero) || 0, nombre: String(row.nombre || "") };
      }),
    };
  }).filter((track) => track.numero > 0 && track.nombre && track.secciones.length > 0);
}

function validateTracks(tracks: YardTrack[]) {
  if (!tracks.length) return "Genera o agrega al menos una vía de arrastre.";
  const numbers = new Set<number>();
  const names = new Set<string>();
  for (const track of tracks) {
    const name = track.nombre.trim().toLocaleLowerCase("es-MX");
    if (!Number.isInteger(track.numero) || track.numero <= 0) return "Cada vía necesita un número válido.";
    if (!name) return `Captura el nombre de la vía ${track.numero}.`;
    if (numbers.has(track.numero)) return `La vía número ${track.numero} está repetida.`;
    if (names.has(name)) return `El nombre “${track.nombre.trim()}” está repetido.`;
    if (!track.secciones.length) return `${track.nombre} necesita al menos una sección.`;
    numbers.add(track.numero);
    names.add(name);
  }
  return null;
}

export function TorreonArrastreYardManager() {
  const localidadId = getPrimaryTorreonLocalidadId();
  const [tracks, setTracks] = useState<YardTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(10);
  const [sectionsPerTrack, setSectionsPerTrack] = useState(3);

  const totalSections = useMemo(() => tracks.reduce((total, track) => total + track.secciones.length, 0), [tracks]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/torreon/arrastre-catalogo?localidadId=${localidadId}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(payload?.message || payload?.error || "No se pudo cargar el patio de arrastre."));
      setTracks(readTracks(payload));
      setDirty(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el patio de arrastre.");
    } finally {
      setLoading(false);
    }
  }, [localidadId]);

  useEffect(() => { void load(); }, [load]);

  function generate() {
    if (tracks.some((track) => track.id)) {
      setError("El patio ya tiene vías guardadas. Agrega vías individualmente para conservar sus identificadores operativos.");
      return;
    }
    setTracks(makeTracks(start, end, sectionsPerTrack));
    setDirty(true);
    setError(null);
    setNotice(null);
  }

  function updateTrack(index: number, patch: Partial<YardTrack>) {
    setTracks((current) => current.map((track, currentIndex) => currentIndex === index ? { ...track, ...patch } : track));
    setDirty(true);
    setNotice(null);
  }

  function updateSectionCount(index: number, count: number) {
    setTracks((current) => current.map((track, currentIndex) => {
      if (currentIndex !== index) return track;
      const safeCount = Math.max(track.secciones.filter((section) => section.id).length, Math.min(200, Math.max(1, count)));
      const sections = Array.from({ length: safeCount }, (_, sectionIndex) => track.secciones[sectionIndex] || { numero: sectionIndex + 1, nombre: `Sección ${sectionIndex + 1}` });
      return { ...track, secciones: sections };
    }));
    setDirty(true);
    setNotice(null);
  }

  function addTrack() {
    const nextNumber = tracks.reduce((max, track) => Math.max(max, track.numero), 0) + 1;
    setTracks((current) => [...current, { numero: nextNumber, nombre: `Vía Arrastre ${nextNumber}`, secciones: makeSections(sectionsPerTrack) }]);
    setDirty(true);
    setNotice(null);
  }

  function removeUnsavedTrack(index: number) {
    setTracks((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setDirty(true);
  }

  async function save() {
    const validationError = validateTracks(tracks);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/torreon/arrastre-catalogo", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          localidadId,
          vias: tracks.map((track) => ({
            ...(track.id ? { id: track.id } : {}),
            numero: track.numero,
            nombre: track.nombre.trim(),
            secciones: track.secciones.map((section) => ({ ...(section.id ? { id: section.id } : {}), numero: section.numero, nombre: section.nombre.trim() })),
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(payload?.message || payload?.error || "No se pudo guardar el patio de arrastre."));
      setTracks(readTracks(payload));
      setDirty(false);
      setNotice("Patio de Arrastre guardado. Estas vías ya están disponibles en las solicitudes de Torreón.");
      window.dispatchEvent(new CustomEvent("cosaif:arrastre-catalog-updated", { detail: { localidadId } }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el patio de arrastre.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="arrastre-yard-title" className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-950 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/60 p-4 dark:border-blue-950 dark:bg-blue-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><TrainFront className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Edición del patio · Torreón</p>
            <h2 id="arrastre-yard-title" className="text-lg font-black">Vías y secciones de Arrastre</h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Estas vías son exclusivas de Arrastre y nunca se mezclan con el patio natural.</p>
          </div>
        </div>
        <button type="button" className={`${buttonClass} border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`} onClick={() => void load()} disabled={loading || saving}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </button>
      </div>

      <div className="space-y-4 p-4">
        {(error || notice) ? <div aria-live="polite">{error ? <YardMessage tone="error" text={error} /> : <YardMessage tone="success" text={notice || ""} />}</div> : null}

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <Field label="Vía inicial"><input className={inputClass} type="number" min={1} value={start} onChange={(event) => setStart(Number(event.target.value))} /></Field>
          <Field label="Vía final"><input className={inputClass} type="number" min={1} value={end} onChange={(event) => setEnd(Number(event.target.value))} /></Field>
          <Field label="Secciones por vía"><input className={inputClass} type="number" min={1} max={200} value={sectionsPerTrack} onChange={(event) => setSectionsPerTrack(Number(event.target.value))} /></Field>
          <button type="button" className={`${buttonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={generate} disabled={loading || saving}><Plus className="h-4 w-4" /> Generar patio</button>
        </div>

        {loading && !tracks.length ? <div className="h-36 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-900" /> : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800">
            <div className="hidden grid-cols-[100px_minmax(180px,1fr)_150px_54px] gap-3 bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:bg-zinc-900 md:grid"><span>Número</span><span>Nombre</span><span>Secciones</span><span /></div>
            <div className="max-h-[430px] divide-y divide-slate-100 overflow-auto dark:divide-zinc-900">
              {tracks.map((track, index) => (
                <div key={track.id ? `arrastre-via-${track.id}` : `arrastre-new-${index}`} className="grid gap-3 p-3 md:grid-cols-[100px_minmax(180px,1fr)_150px_54px] md:items-center">
                  <Field label="Número"><input className={inputClass} type="number" min={1} value={track.numero} onChange={(event) => updateTrack(index, { numero: Number(event.target.value) })} /></Field>
                  <Field label="Nombre"><input className={inputClass} maxLength={100} value={track.nombre} onChange={(event) => updateTrack(index, { nombre: event.target.value })} /></Field>
                  <Field label="Secciones"><input className={inputClass} type="number" min={Math.max(1, track.secciones.filter((section) => section.id).length)} max={200} value={track.secciones.length} onChange={(event) => updateSectionCount(index, Number(event.target.value))} /></Field>
                  {track.id ? <span className="hidden h-11 w-11 md:block" /> : <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-300" onClick={() => removeUnsavedTrack(index)} aria-label={`Quitar ${track.nombre}`}><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
              {!tracks.length ? <p className="p-6 text-center text-sm font-bold text-slate-500 dark:text-zinc-400">Aún no se ha generado el patio de Arrastre.</p> : null}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">{tracks.length} vías de arrastre · {totalSections} secciones</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`} onClick={addTrack} disabled={loading || saving}><Plus className="h-4 w-4" /> Agregar vía</button>
            <button type="button" className={`${buttonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={() => void save()} disabled={loading || saving || !dirty || !tracks.length}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar patio de Arrastre</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-500">{label}</span>{children}</label>;
}

function YardMessage({ tone, text }: { tone: "error" | "success"; text: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  const classes = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200";
  return <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-bold ${classes}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" />{text}</div>;
}
