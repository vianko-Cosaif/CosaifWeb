"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Save,
  Settings2,
  Trash2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchCatalogSummary, saveOperationalLocation } from "./api";
import type { CatalogLocation, CatalogSummary, TrackDraft } from "./types";

const inputClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100";
const labelClass =
  "text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500";
const buttonBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";

function makeTracks(start: number, end: number, secciones: number): TrackDraft[] {
  const safeStart = Math.max(1, Math.min(start, end));
  const safeEnd = Math.max(start, end);
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => {
    const numero = safeStart + index;
    return { numero, nombre: `Via ${numero}`, secciones };
  });
}

function tracksFromLocation(location: CatalogLocation): TrackDraft[] {
  return location.vias.map((via) => ({
    id: via.id,
    numero: via.numero,
    nombre: via.nombre,
    secciones: via.secciones.length,
  }));
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default function CatalogosOperativosPageClient() {
  const [summary, setSummary] = useState<CatalogSummary>({ localidades: [], warnings: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState("ACTIVA");
  const [inicio, setInicio] = useState(1);
  const [fin, setFin] = useState(30);
  const [seccionesPorVia, setSeccionesPorVia] = useState(3);
  const [cantidadNavajas, setCantidadNavajas] = useState(0);
  const [tracks, setTracks] = useState<TrackDraft[]>(() => makeTracks(1, 30, 3));

  const selectedLocation = useMemo(
    () => summary.localidades.find((location) => location.id === selectedId) ?? null,
    [selectedId, summary.localidades],
  );

  const totals = useMemo(() => {
    return summary.localidades.reduce(
      (acc, location) => {
        acc.vias += location.totalVias;
        acc.secciones += location.totalSecciones;
        if (location.torno.configurado) acc.torno += 1;
        return acc;
      },
      { localidades: summary.localidades.length, vias: 0, secciones: 0, torno: 0 },
    );
  }, [summary.localidades]);

  const kpis: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Localidades", value: totals.localidades, icon: MapPin },
    { label: "Vias", value: totals.vias, icon: Route },
    { label: "Secciones", value: totals.secciones, icon: Settings2 },
    { label: "Torno configurado", value: totals.torno, icon: Wrench },
  ];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchCatalogSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar configuracion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForNew() {
    setSelectedId(null);
    setNombre("");
    setEstado("ACTIVA");
    setCantidadNavajas(0);
    setInicio(1);
    setFin(30);
    setSeccionesPorVia(3);
    setTracks(makeTracks(1, 30, 3));
    setNotice(null);
    setError(null);
  }

  function loadLocation(location: CatalogLocation) {
    setSelectedId(location.id);
    setNombre(location.nombre);
    setEstado(location.estado || "ACTIVA");
    setCantidadNavajas(location.torno.cantidadNavajas || 0);
    setTracks(tracksFromLocation(location));
    setNotice(`Editando ${location.nombre}`);
    setError(null);
  }

  function generateTracks(nextStart = inicio, nextEnd = fin, nextSections = seccionesPorVia) {
    setTracks(makeTracks(nextStart, nextEnd, Math.max(0, nextSections)));
  }

  function updateTrack(index: number, patch: Partial<TrackDraft>) {
    setTracks((current) => current.map((track, i) => (i === index ? { ...track, ...patch } : track)));
  }

  function addTrack() {
    const nextNumber = tracks.reduce((max, track) => Math.max(max, track.numero), 0) + 1;
    setTracks((current) => [
      ...current,
      { numero: nextNumber, nombre: `Via ${nextNumber}`, secciones: seccionesPorVia },
    ]);
  }

  function removeTrack(index: number) {
    setTracks((current) => current.filter((_, i) => i !== index));
  }

  async function submit() {
    const cleanName = nombre.trim();
    if (!cleanName) {
      setError("Nombre de localidad requerido");
      return;
    }
    if (!tracks.length) {
      setError("Agrega al menos una via");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveOperationalLocation({
        localidad: {
          ...(selectedId ? { id: selectedId } : {}),
          nombre: cleanName,
          estado,
        },
        vias: tracks
          .slice()
          .sort((a, b) => a.numero - b.numero)
          .map((track) => ({
            ...(track.id ? { id: track.id } : {}),
            numero: Number(track.numero),
            nombre: track.nombre.trim() || `Via ${track.numero}`,
            secciones: Math.max(0, Number(track.secciones) || 0),
          })),
        torno: {
          configurar: cantidadNavajas > 0,
          cantidadNavajas: Math.max(0, Number(cantidadNavajas) || 0),
        },
      });
      setNotice("Configuracion guardada");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-svh bg-slate-50 px-4 py-6 text-slate-950 dark:bg-neutral-950 dark:text-zinc-50 sm:px-6 lg:px-10">
      <section className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Administracion
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Configuracion operativa</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600 dark:text-zinc-400">
                Alta controlada de localidades, vias, secciones y configuracion de Torno.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${buttonBase} border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`}
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualizar
              </button>
              <button
                type="button"
                className={`${buttonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                onClick={resetForNew}
              >
                <Plus className="h-4 w-4" />
                Nueva localidad
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <p className={labelClass}>{label}</p>
                <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        {(error || notice || summary.warnings.length > 0) && (
          <div className="space-y-2">
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {notice}
              </div>
            )}
            {summary.warnings.map((warning, index) => (
              <div
                key={`${warning.scope}-${index}`}
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {warning.message}
              </div>
            ))}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-black">Localidades existentes</h2>
              <p className="text-sm font-semibold text-slate-500 dark:text-zinc-500">
                Selecciona una para editar su estructura.
              </p>
            </div>
            <div className="max-h-[640px] overflow-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-900">
                  {summary.localidades.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => loadLocation(location)}
                      className={`w-full p-4 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-900/60 ${
                        selectedId === location.id ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black">{location.nombre}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {location.estado}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
                          ID {location.id}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm font-bold text-slate-600 dark:text-zinc-400 sm:grid-cols-3">
                        <span>{formatCount(location.totalVias, "via", "vias")}</span>
                        <span>{formatCount(location.totalSecciones, "seccion", "secciones")}</span>
                        <span>{location.torno.cantidadNavajas} navajas</span>
                      </div>
                    </button>
                  ))}
                  {!summary.localidades.length && (
                    <div className="p-8 text-center text-sm font-bold text-slate-500">
                      Sin localidades registradas.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-black">
                {selectedLocation ? `Editar ${selectedLocation.nombre}` : "Nueva localidad operativa"}
              </h2>
              <p className="text-sm font-semibold text-slate-500 dark:text-zinc-500">
                Guarda localidad, vias, secciones y Torno desde un solo flujo.
              </p>
            </div>

            <div className="space-y-6 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Localidad</span>
                  <input
                    className={inputClass}
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    placeholder="Guadalajara, Torreon..."
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Estado</span>
                  <select className={inputClass} value={estado} onChange={(event) => setEstado(event.target.value)}>
                    <option value="ACTIVA">ACTIVA</option>
                    <option value="INACTIVA">INACTIVA</option>
                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Navajas Torno</span>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    value={cantidadNavajas}
                    onChange={(event) => setCantidadNavajas(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <label className="flex flex-1 flex-col gap-2">
                    <span className={labelClass}>Via inicio</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      value={inicio}
                      onChange={(event) => setInicio(Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-2">
                    <span className={labelClass}>Via fin</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      value={fin}
                      onChange={(event) => setFin(Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-2">
                    <span className={labelClass}>Secciones por via</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={seccionesPorVia}
                      onChange={(event) => setSeccionesPorVia(Number(event.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    className={`${buttonBase} border-slate-200 bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950`}
                    onClick={() => generateTracks()}
                  >
                    <Settings2 className="h-4 w-4" />
                    Generar
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`${buttonBase} h-9 border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`}
                    onClick={() => {
                      setInicio(1);
                      setFin(30);
                      setSeccionesPorVia(3);
                      generateTracks(1, 30, 3);
                    }}
                  >
                    Plantilla 30 vias / 3 secciones
                  </button>
                  <button
                    type="button"
                    className={`${buttonBase} h-9 border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`}
                    onClick={addTrack}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar via
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800">
                <div className="grid grid-cols-[110px_1fr_150px_54px] bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-zinc-900 dark:text-zinc-500">
                  <span>Numero</span>
                  <span>Nombre</span>
                  <span>Secciones</span>
                  <span />
                </div>
                <div className="max-h-[380px] divide-y divide-slate-100 overflow-auto dark:divide-zinc-900">
                  {tracks.map((track, index) => (
                    <div key={`${track.id ?? "new"}-${index}`} className="grid grid-cols-[110px_1fr_150px_54px] gap-3 p-3">
                      <input
                        className={inputClass}
                        type="number"
                        min={1}
                        value={track.numero}
                        onChange={(event) => updateTrack(index, { numero: Number(event.target.value) })}
                      />
                      <input
                        className={inputClass}
                        value={track.nombre}
                        onChange={(event) => updateTrack(index, { nombre: event.target.value })}
                      />
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        value={track.secciones}
                        onChange={(event) => updateTrack(index, { secciones: Number(event.target.value) })}
                      />
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        onClick={() => removeTrack(index)}
                        aria-label="Quitar via"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">
                  Se guardaran {formatCount(tracks.length, "via", "vias")} y{" "}
                  {formatCount(tracks.reduce((total, track) => total + Math.max(0, Number(track.secciones) || 0), 0), "seccion", "secciones")}.
                </p>
                <button
                  type="button"
                  className={`${buttonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                  onClick={() => void submit()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar configuracion
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
