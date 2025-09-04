/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon, Info, TimerReset, CheckCircle2, FastForward, X } from "lucide-react";

const API_BASE = process.env.API_URL;
const INCIDENTES = `${API_BASE}/incidentes`;
const EMPTY_IMAGE = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23ECEFF1'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23546E7A' font-family='sans-serif' font-size='24'%3ESin imagen%3C/text%3E%3C/svg%3E";

type Props = {
  incident: any;
  onResolve: (comments?: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  operatorComment?: string;
};

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");        
}

/** Carga una imagen con Authorization: Bearer <token> y expone un blob URL */
function ImageWithAuth({ src, className }: { src: string; className?: string }) {
  const [url, setUrl] = useState<string>(EMPTY_IMAGE);
  useEffect(() => {
    let revoked: string | null = null;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    let alive = true;

    async function run() {
      try {
        if (!src) return;
        const r = await fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error("img fetch error");
        const b = await r.blob();
        if (!alive) return;
        const u = URL.createObjectURL(b);
        revoked = u;
        setUrl(u);
      } catch {
        setUrl(EMPTY_IMAGE);
      }
    }
    run();
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  return <img src={url} className={className} alt="" />;
}

export default function SmartIncidentBlocker({
  incident,
  onResolve,
  onContinue,
  onSkip,
  operatorComment,
}: Props) {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [show, setShow] = useState(true);
  const [resolution, setResolution] = useState("");
  const [fetched, setFetched] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const id = incident?.incidenteId || incident?.id;
        if (!id) throw new Error("Incidente sin ID");
        const r = await fetch(`${INCIDENTES}/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = await r.json();
        if (j?.success === false) throw new Error(j?.error || "Error");
        if (!live) return;
        setFetched(j?.data ?? j);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.message || "Error al cargar incidente");
      } finally {
        if (!live) return;
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [incident, token]);

  const images: string[] = useMemo(() => {
    const x = fetched || {};
    let list: string[] = [];
    if (Array.isArray(x.imagenes) && x.imagenes.length) list = x.imagenes;
    else list = [x.imagen1, x.imagen2, x.imagen3, x.imagen4].filter(Boolean);
    return list.length ? list.map((p: string) => (p.startsWith("http") ? p : `${INCIDENTES}/imagen/${encodeURI(p)}`)) : [];
  }, [fetched]);
  const [idx, setIdx] = useState(0);
  const realCount = images.length;

  // Timer 10 min
  const incidentDate = useMemo(() => fetched?.fechaInicio || incident?.fechaInicio || Date.now(), [fetched, incident]);
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const windowMs = 10 * 60 * 1000;
  const left = Math.max(0, windowMs - (now - new Date(incidentDate).getTime()));
  const showTimer = left > 0 && (fetched?.estado || incident?.estado || "ABIERTO") === "ABIERTO";
  const pct = Math.round(((windowMs - left) / windowMs) * 100);
  const urgency =
    pct < 50 ? { label: "NORMAL", color: "text-emerald-300", bar: "bg-emerald-300" } :
    pct < 85 ? { label: "ALERTA", color: "text-amber-300", bar: "bg-amber-300" } :
               { label: "CRITICO", color: "text-rose-300", bar: "bg-rose-300" };
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  const estado = (fetched?.estado || incident?.estado || "ABIERTO") as string;
  const estadoColor =
    estado === "ABIERTO" ? "text-amber-600" : estado === "RESUELTO" ? "text-emerald-600" : "text-rose-600";

  const doResolve = useCallback(async () => {
    if (!token) return alert("Sin token");
    const id = fetched?.id || incident?.id;
    const r = await fetch(`${INCIDENTES}/${id}/resuelto`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "RESUELTO", comentario: resolution.trim() }),
    });
    if (!r.ok) return alert("Error al resolver");
    setShow(false);
    onResolve(resolution.trim());
  }, [fetched, incident, resolution, token, onResolve]);

  const doSkip = useCallback(async () => {
    if (!token) return alert("Sin token");
    const id = fetched?.id || incident?.id;
    const r = await fetch(`${INCIDENTES}/${id}/cerrar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return alert("Error al cerrar");
    setShow(false);
    onSkip();
  }, [fetched, incident, token, onSkip]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 p-4">
      <div className="mt-6 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("h-3 w-3 rounded-full", urgency.bar)} />
              <h2 className="truncate text-lg font-bold text-white">
                {(fetched?.descripcion || incident?.descripcion || "Incidente").slice(0, 60)}
                {(fetched?.descripcion || "").length > 60 ? "…" : ""}
              </h2>
            </div>
            <button onClick={() => setShow(false)} className="rounded-md p-1 text-white/90 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          {showTimer && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-white">
                <TimerReset className="h-4 w-4" />
                <span className={cn("text-base font-bold", urgency.color)}>{fmt(left)}</span>
                <span className="text-xs opacity-90">restante</span>
                <span className="ml-3 text-xs">{urgency.label}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded bg-white/30">
                <div className={cn("h-2 rounded", urgency.bar)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className={cn("flex items-center gap-2 text-sm font-semibold", estadoColor)}>
            <Info className="h-4 w-4" />
            <span className="uppercase">{estado.toLowerCase()}</span>
          </div>
          {showTimer && <div className={cn("text-xs font-semibold", urgency.color)}>{urgency.label}</div>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b px-4">
          <button
            onClick={() => setActiveTab(0)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-4 px-3 py-3 text-sm font-semibold",
              activeTab === 0 ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"
            )}
          >
            <Info className="h-4 w-4" />
            Detalles
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-4 px-3 py-3 text-sm font-semibold",
              activeTab === 1 ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"
            )}
          >
            <ImageIcon className="h-4 w-4" />
            Imágenes {realCount ? `(${realCount})` : ""}
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Cargando…</div>
          ) : err ? (
            <div className="rounded-lg bg-rose-50 p-4 text-rose-700">{err}</div>
          ) : activeTab === 0 ? (
            <div className="space-y-4">
              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-800">
                  <Info className="h-5 w-5 text-emerald-600" />
                  Descripción
                </h3>
                <p className="text-slate-800">{fetched?.descripcion ?? "—"}</p>
              </section>

              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reportado</div>
                    <div className="text-sm font-medium text-slate-700">
                      {new Date(incidentDate).toLocaleString("es-ES")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Empresa</div>
                    <div className="text-sm font-medium text-slate-700">
                      {fetched?.movimiento?.empresa?.nombre ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Locomotora</div>
                    <div className="text-sm font-medium text-slate-700">
                      {fetched?.movimiento?.locomotiveNumber ? `#${fetched.movimiento.locomotiveNumber}` : "—"}
                    </div>
                  </div>
                </div>
              </section>

              {operatorComment && (
                <section className="rounded-xl border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-base font-semibold text-slate-800">Comentario operador</h3>
                  <p className="text-slate-800">{operatorComment}</p>
                </section>
              )}

              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-base font-semibold text-slate-800">Resolución</h3>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500"
                  placeholder="Describe las acciones tomadas"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setResolution("")}
                    className="flex-1 rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-400"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={doResolve}
                    disabled={!resolution.trim()}
                    className={cn(
                      "flex-[2] rounded-lg px-4 py-2 text-sm font-semibold text-white",
                      resolution.trim()
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "cursor-not-allowed bg-slate-300"
                    )}
                  >
                    Confirmar resolución
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative h-[320px] overflow-hidden rounded-xl border bg-white shadow-sm">
                {realCount ? (
                  <ImageWithAuth src={images[Math.min(idx, realCount - 1)]} className="h-full w-full object-contain" />
                ) : (
                  <img src={EMPTY_IMAGE} className="h-full w-full object-contain" alt="" />
                )}
                {realCount > 1 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-48 items-center justify-between rounded-full bg-black/60 px-3 py-1 text-white">
                    <button
                      onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                      className="pointer-events-auto rounded px-2 py-1 hover:bg-white/10"
                    >
                      {"<"}
                    </button>
                    <span className="text-sm">
                      {Math.min(idx + 1, realCount)}/{realCount}
                    </span>
                    <button
                      onClick={() => setIdx((i) => Math.min(i + 1, realCount - 1))}
                      className="pointer-events-auto rounded px-2 py-1 hover:bg-white/10"
                    >
                      {">"}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: Math.max(realCount, 4) }).map((_, i) => {
                    const src = images[i];
                    const disabled = !src;
                    return (
                      <button
                        key={i}
                        disabled={disabled}
                        onClick={() => !disabled && setIdx(i)}
                        className={cn(
                          "aspect-square overflow-hidden rounded-lg border",
                          i === idx && !disabled ? "border-emerald-600" : "border-slate-200",
                          disabled && "opacity-50"
                        )}
                      >
                        {src ? (
                          <ImageWithAuth src={src} className="h-full w-full object-cover" />
                        ) : (
                          <img src={EMPTY_IMAGE} className="h-full w-full object-cover" alt="" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t bg-white px-6 py-4">
          {showTimer && estado === "ABIERTO" ? (
            <>
              <button
                onClick={doResolve}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-5 w-5" />
                Resolver
              </button>
              <button
                onClick={doSkip}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600"
              >
                <FastForward className="h-5 w-5" />
                Omitir
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setShow(false);
                onContinue();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
