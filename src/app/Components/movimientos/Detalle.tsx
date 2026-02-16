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
interface DetalleMovimiento {
  id: number;
  locomotora?: string | number;
  estado?: string;
  prioridad?: string;
  fechaSolicitud?: string;
  fechaInicio?: string;
  fechaFin?: string;
  viaOrigenNombre?: string;
  viaDestinoNombre?: string;
  posicionCabina?: string;
  posicionChimenea?: string;
  instrucciones?: string;
  empresa?: RefNombre;
  localidad?: RefNombre;
  supervisor?: RefNombre;
  maquinista?: RefNombre;
  operador?: RefNombre;
  cliente?: RefNombre;
  lavado?: boolean;
  torno?: boolean;
  incidenteGlobal?: boolean;
  movementType?: string;
  direccionEmpuje?: string;
}

interface DetalleProps {
  movimientoId: number;
  apiBase?: string;
  onCerrar: () => void;
  onGuardado?: () => void;
}

/* ================== COMPONENTE ================== */

export default function Detalle({
  movimientoId,
  apiBase = API_BASE,
  onCerrar,
  onGuardado,
}: DetalleProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [detalle, setDetalle] = useState<DetalleMovimiento | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [instruccionesEdit, setInstruccionesEdit] = useState("");
  const [guardando, setGuardando] = useState(false);

  /* Cerrar con Esc */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCerrar]);

  /* Click fuera */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCerrar();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCerrar]);

  /* Fetch */
  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    setError(null);

    fetch(`${apiBase}/movimientos/${movimientoId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setDetalle(data);
          setInstruccionesEdit(data.instrucciones ?? "");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Error desconocido");
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase, movimientoId]);

  /* Guardar instrucciones */
  const handleGuardarInstrucciones = async () => {
    if (!detalle) return;
    setGuardando(true);
    try {
      const res = await fetch(`${apiBase}/movimientos/${detalle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ instrucciones: instruccionesEdit }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setDetalle((prev) =>
        prev ? { ...prev, instrucciones: instruccionesEdit } : prev
      );
      setModoEdicion(false);
      if (onGuardado) onGuardado();
    } catch {
      alert("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  /* ========= RENDER ========= */

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[3px] animate-[fadeIn_0.2s_ease]"
        onClick={onCerrar}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="
          relative z-10
          flex flex-col
          w-full max-w-lg
          bg-white dark:bg-slate-950
          border-l border-slate-200 dark:border-slate-800
          shadow-2xl shadow-slate-900/10 dark:shadow-black/30
          animate-[slideIn_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]
          overflow-hidden
        "
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
              <Train size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Movimiento{" "}
                <span className="text-emerald-600 dark:text-emerald-400">
                  #{movimientoId}
                </span>
              </h2>
              {detalle?.locomotora && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Locomotora {detalle.locomotora}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-all active:scale-90"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {cargando ? (
            <SkeletonBody />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                <BadgeAlert size={28} />
              </div>
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                {error}
              </p>
              <button
                onClick={onCerrar}
                className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          ) : detalle ? (
            <>
              {/* Estado badge */}
              <div className="flex items-center justify-between">
                <EstadoBadge estado={detalle.estado} />
                {detalle.prioridad === "ALTA" && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                    <BadgeAlert size={12} />
                    PRIORIDAD ALTA
                  </span>
                )}
              </div>

              {/* Operación */}
              <SectionCard title="Operación de Vía" icon={MapPin} accentColor="emerald">
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Origen</div>
                    <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {detalle.viaOrigenNombre || "—"}
                    </div>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-emerald-500" />
                  <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destino</div>
                    <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {detalle.viaDestinoNombre || "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <MiniChip label={`Cabina: ${detalle.posicionCabina ?? "—"}`} />
                  <MiniChip label={`Chimenea: ${detalle.posicionChimenea ?? "—"}`} />
                  {detalle.movementType && <MiniChip label={detalle.movementType} />}
                  {detalle.direccionEmpuje && <MiniChip label={`Dir: ${detalle.direccionEmpuje}`} />}
                </div>
              </SectionCard>

              {/* Fechas */}
              <SectionCard title="Cronograma" icon={Calendar} accentColor="blue">
                <div className="space-y-2">
                  <FechaRow label="Solicitud" valor={detalle.fechaSolicitud} />
                  <FechaRow label="Inicio" valor={detalle.fechaInicio} color="emerald" />
                  <FechaRow label="Fin" valor={detalle.fechaFin} />
                </div>
              </SectionCard>

              {/* Entidades */}
              <SectionCard title="Empresa & Localidad" icon={Building2} accentColor="purple">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoField label="Empresa" value={detalle.empresa?.nombre} />
                  <InfoField label="Localidad" value={detalle.localidad?.nombre} />
                </div>
              </SectionCard>

              {/* Personal */}
              <SectionCard title="Personal Asignado" icon={User2} accentColor="sky">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoField label="Supervisor" value={detalle.supervisor?.nombre} />
                  <InfoField label="Maquinista" value={detalle.maquinista?.nombre} />
                  <InfoField label="Operador" value={detalle.operador?.nombre} />
                  <InfoField label="Cliente" value={detalle.cliente?.nombre} />
                </div>
              </SectionCard>

              {/* Servicios */}
              {(detalle.lavado || detalle.torno || detalle.incidenteGlobal) && (
                <SectionCard title="Servicios" icon={Clock} accentColor="amber">
                  <div className="flex flex-wrap gap-2">
                    {detalle.lavado && <ServiceChip label="Lavado" type="ok" />}
                    {detalle.torno && <ServiceChip label="Torno" type="ok" />}
                    {detalle.incidenteGlobal && <ServiceChip label="Incidente Global" type="danger" />}
                  </div>
                </SectionCard>
              )}

              {/* Instrucciones */}
              <SectionCard title="Instrucciones" icon={FileText} accentColor="amber">
                {modoEdicion ? (
                  <>
                    <textarea
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:border-emerald-500 transition-all"
                      value={instruccionesEdit}
                      onChange={(e) => setInstruccionesEdit(e.target.value)}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleGuardarInstrucciones}
                        disabled={guardando}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
                      >
                        {guardando ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        {guardando ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        onClick={() => {
                          setModoEdicion(false);
                          setInstruccionesEdit(detalle.instrucciones ?? "");
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => setModoEdicion(true)}
                    className="cursor-pointer rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-3 text-sm text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors min-h-[60px]"
                  >
                    {detalle.instrucciones || (
                      <span className="italic text-slate-400 dark:text-slate-500">
                        Sin instrucciones — clic para agregar
                      </span>
                    )}
                  </div>
                )}
              </SectionCard>
            </>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/* ================== SECTION CARD ================== */

const ACCENT_MAP: Record<string, string> = {
  emerald: "border-l-emerald-400 dark:border-l-emerald-500",
  blue: "border-l-sky-400 dark:border-l-sky-500",
  sky: "border-l-sky-400 dark:border-l-sky-500",
  amber: "border-l-amber-400 dark:border-l-amber-500",
  purple: "border-l-violet-400 dark:border-l-violet-500",
};

function SectionCard({
  title,
  icon: Icon,
  accentColor = "emerald",
  children,
}: {
  title: string;
  icon: React.ElementType;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const accent = ACCENT_MAP[accentColor] ?? ACCENT_MAP.emerald;
  return (
    <div className={`rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 overflow-hidden border-l-[3px] ${accent}`}>
      <div className="px-4 pt-3 pb-1">
        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <Icon size={12} className="opacity-70" /> {title}
        </h4>
      </div>
      <div className="px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

/* ================== ESTADO BADGE ================== */

function EstadoBadge({ estado }: { estado?: string }) {
  const e = (estado || "").toUpperCase();

  const colors: Record<string, string> = {
    SOLICITADO: "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-400",
    EN_PROCESO: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400",
    CONCLUIDO: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400",
    CANCELADO: "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400",
    DETENIDO: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400",
  };

  const dots: Record<string, string> = {
    SOLICITADO: "bg-sky-500",
    EN_PROCESO: "bg-amber-500 animate-pulse",
    CONCLUIDO: "bg-emerald-500",
    CANCELADO: "bg-rose-500",
    DETENIDO: "bg-red-500",
  };

  const cls = colors[e] ?? "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400";
  const dot = dots[e] ?? "bg-slate-400";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {e || "DESCONOCIDO"}
    </span>
  );
}

/* ================== SUBCOMPONENTS ================== */

function SkeletonBody() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
          <div className="h-3 w-24 rounded-md bg-slate-200 dark:bg-slate-800 mb-3" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded-md bg-slate-100 dark:bg-slate-800/60" />
            <div className="h-4 w-3/4 rounded-md bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );
}

function FechaRow({
  label,
  valor,
  color,
}: {
  label: string;
  valor?: string;
  color?: string;
}) {
  const formatted = useMemo(() => {
    if (!valor) return "—";
    const ts = Date.parse(valor);
    if (Number.isNaN(ts)) return valor;
    return new Date(ts).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [valor]);

  const textColor = color === "emerald"
    ? "text-emerald-600 dark:text-emerald-400 font-bold"
    : "text-slate-700 dark:text-slate-200";

  return (
    <div className="flex items-baseline justify-between border-b border-slate-50 dark:border-slate-800/50 py-1.5 last:border-0 text-xs">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-medium tabular-nums ${textColor}`}>{formatted}</span>
    </div>
  );
}

function MiniChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
  );
}

function ServiceChip({
  label,
  type,
}: {
  label: string;
  type: "ok" | "danger";
}) {
  const cls =
    type === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800";

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${type === "ok" ? "bg-emerald-500" : "bg-rose-500"}`} />
      {label}
    </span>
  );
}
