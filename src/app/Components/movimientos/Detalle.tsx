// src/app/Components/movimientos/Detalle.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Train,
  MapPin,
  ArrowRight,
  Building2,
  BadgeAlert,
  Clock,
  Calendar,
  FileText,
  User2,
  Save,
  Loader2,
} from "lucide-react";

/* ========= Config por defecto ========= */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "/xapi";

/* ========= Tipos ========= */
interface RefNombre {
  id?: number;
  nombre?: string;
}
interface EventoLinea {
  fecha: string;
  descripcion: string;
}
interface DetalleMovimiento {
  id: number;
  empresa?: RefNombre | string;
  localidad?: RefNombre | string;
  estado?: string;
  tipo?: string | null;
  prioridad?: string | number | null;

  locomotora?: string | number;
  locomotiveNumber?: string | number;

  viaOrigen?: RefNombre | string | number | null;
  viaDestino?: RefNombre | string | number | null;

  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;

  solicitante?: RefNombre | string | null;
  notas?: string | null;

  acciones?: string[]; // opcional
  eventos?: EventoLinea[]; // historial opcional
}

export interface DetalleProps {
  abierto: boolean;
  movimientoId: number | null;
  onCerrar: () => void;

  // Si no lo pasas, usa GET ${API_BASE}/movimientos/:id
  obtenerDetalle?: (
    id: number,
    signal: AbortSignal
  ) => Promise<DetalleMovimiento>;

  // Opcional: avisar al padre que se guardó algo
  onActualizado?: (detalle: DetalleMovimiento) => void;
}

/* ========= Componente ========= */
export default function Detalle({
  abierto,
  movimientoId,
  onCerrar,
  obtenerDetalle,
  onActualizado,
}: DetalleProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleMovimiento | null>(null);

  const [editPrioridad, setEditPrioridad] = useState<string>("");
  const [editNotas, setEditNotas] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Construye el fetch por defecto
  const fetchPorDefecto = useMemo(
    () =>
      async (id: number, signal: AbortSignal): Promise<DetalleMovimiento> => {
        const r = await fetch(`${API_BASE}/movimientos/${id}`, {
          signal,
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as unknown;
        const d = normalizarDetalle(data);
        return d;
      },
    []
  );

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onCerrar]);

  // Cargar detalle cuando cambie id o se abra
  useEffect(() => {
    if (!abierto || !movimientoId) return;
    setCargando(true);
    setError(null);
    setDetalle(null);
    setMensajeOk(null);

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const fn = obtenerDetalle ?? fetchPorDefecto;

    fn(movimientoId, ac.signal)
      .then((d) => setDetalle(d))
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Error de red";
        setError(msg);
      })
      .finally(() => setCargando(false));

    return () => ac.abort();
  }, [abierto, movimientoId, obtenerDetalle, fetchPorDefecto]);

  // Sincronizar formulario cuando llegue el detalle
  useEffect(() => {
    if (!detalle) return;
    setEditPrioridad(
      detalle.prioridad !== null && detalle.prioridad !== undefined
        ? String(detalle.prioridad)
        : ""
    );
    setEditNotas(detalle.notas ?? "");
    setMensajeOk(null);
  }, [detalle]);

  const handleGuardar = async () => {
    if (!detalle) return;
    setGuardando(true);
    setError(null);
    setMensajeOk(null);

    try {
      const r = await fetch(`${API_BASE}/movimientos/${detalle.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prioridad: editPrioridad || null,
          notas: editNotas ?? null,
        }),
      });

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }

      const data = (await r.json()) as unknown;
      const d = normalizarDetalle(data);
      setDetalle(d);
      setMensajeOk("Cambios guardados.");
      if (onActualizado) onActualizado(d);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle-mov"
      className="fixed inset-0 z-50 flex"
    >
      {/* Fondo */}
      <div
        className="flex-1 bg-black/40"
        onClick={onCerrar}
        aria-label="Cerrar detalle"
      />

      {/* Panel */}
      <aside className="w-full max-w-[520px] h-full bg-white dark:bg-zinc-950 shadow-xl overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
          <h2 id="titulo-detalle-mov" className="text-base font-semibold">
            Detalle del movimiento
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded p-2 hover:bg-black/5"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {cargando && <Esqueleto />}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
              {error}
            </div>
          )}

          {!cargando && !error && detalle && (
            <>
              <ResumenTop detalle={detalle} />

              <div className="mt-2 grid grid-cols-1 gap-3">
                <InfoLinea
                  icono={<Building2 size={16} aria-hidden />}
                  etiqueta="Empresa"
                  valor={leerNombre(detalle.empresa)}
                />
                <InfoLinea
                  icono={<MapPin size={16} aria-hidden />}
                  etiqueta="Localidad"
                  valor={leerNombre(detalle.localidad)}
                />
                <InfoLinea
                  icono={<BadgeAlert size={16} aria-hidden />}
                  etiqueta="Prioridad"
                  valor={detalle.prioridad ?? "—"}
                />
                <InfoLinea
                  icono={<User2 size={16} aria-hidden />}
                  etiqueta="Solicitante"
                  valor={leerNombre(detalle.solicitante) || "—"}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <TituloSeccion texto="Trazas y tiempos" />
                <ParesFechas
                  solicitud={detalle.fechaSolicitud}
                  inicio={detalle.fechaInicio}
                  fin={detalle.fechaFin}
                />
                <InfoLinea
                  icono={<FileText size={16} aria-hidden />}
                  etiqueta="Notas"
                  valor={detalle.notas || "—"}
                  multilinea
                />
              </div>

              {/* Edición básica equivalente al móvil */}
              <div className="mt-6 space-y-3">
                <TituloSeccion texto="Edición rápida" />
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {/* Prioridad editable */}
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="col-span-1 inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                      <BadgeAlert size={16} aria-hidden />
                      <span className="font-medium">Prioridad</span>
                    </div>
                    <div className="col-span-2">
                      <select
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:bg-zinc-900 dark:border-zinc-700"
                        value={editPrioridad}
                        onChange={(e) => setEditPrioridad(e.target.value)}
                      >
                        <option value="">Sin cambio</option>
                        <option value="BAJA">BAJA</option>
                        <option value="MEDIA">MEDIA</option>
                        <option value="ALTA">ALTA</option>
                      </select>
                    </div>
                  </div>

                  {/* Notas editables */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1 inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                      <FileText size={16} aria-hidden />
                      <span className="font-medium">Notas</span>
                    </div>
                    <div className="col-span-2">
                      <textarea
                        className="w-full min-h-[80px] rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm resize-y dark:bg-zinc-900 dark:border-zinc-700"
                        value={editNotas}
                        onChange={(e) => setEditNotas(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {mensajeOk && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {mensajeOk}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleGuardar}
                      disabled={guardando}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {guardando ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          Guardar cambios
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {Array.isArray(detalle.eventos) && detalle.eventos.length > 0 && (
                <div className="mt-6">
                  <TituloSeccion texto="Historial" />
                  <ul className="mt-2 space-y-2">
                    {detalle.eventos.map((ev, idx) => (
                      <li key={`${ev.fecha}-${idx}`} className="text-sm">
                        <span className="inline-flex items-center gap-2">
                          <Calendar size={14} aria-hidden />
                          <span className="font-medium">
                            {formatoFechaHora(ev.fecha)}
                          </span>
                        </span>
                        <div className="ml-6 text-zinc-700 dark:text-zinc-300">
                          {ev.descripcion}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ========= Subpartes ========= */
function ResumenTop({ detalle }: { detalle: DetalleMovimiento }) {
  const locomotora = String(
    detalle.locomotiveNumber ?? detalle.locomotora ?? "—"
  );
  const viaO = mostrarVia(detalle.viaOrigen);
  const viaD = mostrarVia(detalle.viaDestino);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm">
          <Train size={16} aria-hidden />
          <span className="font-semibold">Locomotora</span>
        </div>
        <span className="text-base font-bold">{locomotora}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <MapPin size={16} aria-hidden />
        <span className="font-semibold">Vías</span>
        <span className="ml-2 inline-flex items-center gap-2">
          <span className="rounded border px-2 py-0.5">{viaO}</span>
          <ArrowRight size={14} aria-hidden />
          <span className="rounded border px-2 py-0.5">{viaD}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <BadgeEstado valor={detalle.estado ?? "—"} />
        {detalle.tipo ? (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">
            {detalle.tipo}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BadgeEstado({ valor }: { valor: string }) {
  const clase =
    valor === "EN_PROCESO"
      ? "bg-amber-100 text-amber-900"
      : valor === "CONCLUIDO"
      ? "bg-emerald-100 text-emerald-900"
      : valor === "PENDIENTE" || valor === "ESPERA"
      ? "bg-slate-100 text-slate-900"
      : "bg-zinc-100 text-zinc-900";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${clase}`}
    >
      <Clock size={12} aria-hidden />
      {valor}
    </span>
  );
}

function TituloSeccion({ texto }: { texto: string }) {
  return <h3 className="text-sm font-semibold">{texto}</h3>;
}

function InfoLinea({
  icono,
  etiqueta,
  valor,
  multilinea = false,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string | number | null;
  multilinea?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="col-span-1 inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
        {icono}
        <span className="font-medium">{etiqueta}</span>
      </div>
      <div className="col-span-2">
        {multilinea ? (
          <p className="whitespace-pre-wrap">{valor ?? "—"}</p>
        ) : (
          <span>{valor ?? "—"}</span>
        )}
      </div>
    </div>
  );
}

function ParesFechas({
  solicitud,
  inicio,
  fin,
}: {
  solicitud?: string | null;
  inicio?: string | null;
  fin?: string | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <EtiquetaFecha titulo="Solicitud" valor={solicitud} />
      <EtiquetaFecha titulo="Inicio" valor={inicio} />
      <EtiquetaFecha titulo="Fin" valor={fin} />
    </div>
  );
}

function EtiquetaFecha({
  titulo,
  valor,
}: {
  titulo: string;
  valor?: string | null;
}) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{titulo}</div>
      <div className="mt-1 inline-flex items-center gap-2">
        <Calendar size={14} aria-hidden />
        <span className="font-medium">
          {valor ? formatoFechaHora(valor) : "—"}
        </span>
      </div>
    </div>
  );
}

/* ========= Utilidades ========= */
function leerNombre(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "nombre" in v) {
    const n = (v as { nombre?: unknown }).nombre;
    return typeof n === "string" ? n : "";
  }
  return "";
}

function mostrarVia(v: unknown): string | number {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object" && "nombre" in (v as Record<string, unknown>)) {
    const n = (v as { nombre?: unknown }).nombre;
    return typeof n === "string" ? n : "—";
  }
  return "—";
}

function formatoFechaHora(iso: string): string {
  if (!iso) return "";
  const s = iso.trim();
  const base = s.length >= 16 ? s.slice(0, 16) : s;
  return base.replace("T", " ");
}

function normalizarDetalle(data: unknown): DetalleMovimiento {
  if (!data || typeof data !== "object") {
    throw new Error("Detalle inválido");
  }
  const d = data as Record<string, unknown>;

  const id = typeof d.id === "number" ? d.id : NaN;
  if (!Number.isFinite(id)) throw new Error("Detalle sin id");

  return {
    id,
    empresa: d.empresa as DetalleMovimiento["empresa"],
    localidad: d.localidad as DetalleMovimiento["localidad"],
    estado: typeof d.estado === "string" ? d.estado : undefined,
    tipo:
      typeof d.tipo === "string"
        ? d.tipo
        : typeof d.tipoMovimiento === "string"
        ? (d.tipoMovimiento as string)
        : null,
    prioridad:
      typeof d.prioridad === "string" || typeof d.prioridad === "number"
        ? (d.prioridad as string | number)
        : null,
    locomotora:
      typeof d.locomotora === "string" || typeof d.locomotora === "number"
        ? (d.locomotora as string | number)
        : undefined,
    locomotiveNumber:
      typeof d.locomotiveNumber === "string" ||
      typeof d.locomotiveNumber === "number"
        ? (d.locomotiveNumber as string | number)
        : undefined,
    viaOrigen: d.viaOrigen as DetalleMovimiento["viaOrigen"],
    viaDestino: d.viaDestino as DetalleMovimiento["viaDestino"],
    fechaSolicitud:
      typeof d.fechaSolicitud === "string" ? d.fechaSolicitud : null,
    fechaInicio: typeof d.fechaInicio === "string" ? d.fechaInicio : null,
    fechaFin: typeof d.fechaFin === "string" ? d.fechaFin : null,
    solicitante: d.solicitante as DetalleMovimiento["solicitante"],
    notas: typeof d.notas === "string" ? d.notas : null,
    acciones: Array.isArray(d.acciones)
      ? (d.acciones.filter((x) => typeof x === "string") as string[])
      : undefined,
    eventos: Array.isArray(d.eventos)
      ? (d.eventos
          .map((e) =>
            e && typeof e === "object" && "fecha" in e && "descripcion" in e
              ? {
                  fecha: String((e as { fecha: unknown }).fecha ?? ""),
                  descripcion: String(
                    (e as { descripcion: unknown }).descripcion ?? ""
                  ),
                }
              : null
          )
          .filter((x): x is EventoLinea => Boolean(x)) as EventoLinea[])
      : undefined,
  };
}

/* ========= Esqueleto ========= */
function Esqueleto() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-40 bg-black/10 rounded animate-pulse" />
      <div className="h-24 w-full bg-black/10 rounded animate-pulse" />
      <div className="grid grid-cols-1 gap-3">
        <div className="h-10 bg-black/10 rounded animate-pulse" />
        <div className="h-10 bg-black/10 rounded animate-pulse" />
        <div className="h-10 bg-black/10 rounded animate-pulse" />
      </div>
    </div>
  );
}
