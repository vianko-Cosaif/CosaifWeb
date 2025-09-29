/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useIncidentMonitor, type IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";
import IncidentModal from "./IncidentModal";

/* ========== Helpers cookies/auth ========== */
const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

const getAuthHeaders = (): HeadersInit => {
  const token = getCookie("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** empresaId tolerante a typos comunes en cookie */
const getEmpresaIdFromCookie = (): number | null => {
  const raw = getCookie("empresaId") ?? getCookie("empresald") ?? getCookie("empresaID");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** intenta leer empresaId del incidente en distintas formas */
const getIncidentEmpresaId = (inc: any): number | null =>
  Number(
    inc?.empresaId ??
      inc?.empresa?.id ??
      inc?.movimiento?.empresa?.id ??
      inc?._original?.empresaId ??
      inc?._original?.movimiento?.empresa?.id ??
      NaN
  ) || null;

/* ========== Tipos ========== */
interface IncidentMonitorProps {
  apiBase?: string;
  intervalMs?: number;
  enabled?: boolean;
  empresaId?: number | null;
  localidadId?: number | null;
  onIncidentResolved?: (incident: IncidenteEmergente) => void;
  onIncidentSkipped?: (incident: IncidenteEmergente) => void;
  onIncidentContinued?: (incident: IncidenteEmergente) => void;
  mobileMaxWidth?: number;
}

/* ========== Componente ========== */
export default function IncidentMonitor({
  apiBase = "/bff",
  intervalMs = 120000, // 2 minutos
  enabled = true,
  empresaId: empresaIdProp = null,
  localidadId = null,
  onIncidentResolved,
  onIncidentSkipped,
  onIncidentContinued,
  mobileMaxWidth = 768,
}: IncidentMonitorProps) {
  const empresaId = empresaIdProp ?? getEmpresaIdFromCookie();

  const [currentIncident, setCurrentIncident] = useState<IncidenteEmergente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processedIncidents, setProcessedIncidents] = useState<Set<number>>(new Set());

  const [isMobile, setIsMobile] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth <= mobileMaxWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [mobileMaxWidth]);

  useEffect(() => {
    if (!isMobile) setIsSheetOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isSheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSheetOpen]);

  /* ---- Nuevo: validar empresa antes de abrir modal ---- */
  const handleNewIncident = useCallback(
    (incident: IncidenteEmergente) => {
      const userEmp = empresaId ?? getEmpresaIdFromCookie();
      const incEmp = getIncidentEmpresaId(incident);

      if (userEmp && incEmp && userEmp !== incEmp) {
        setProcessedIncidents((prev) => new Set(prev).add(incident.id)); // marcar y no mostrar
        return;
      }
      if (!processedIncidents.has(incident.id)) {
        setCurrentIncident(incident);
        setIsModalOpen(true);
      }
    },
    [processedIncidents, empresaId]
  );

  const { isMonitoring, lastCheck, error, activeIncidents } = useIncidentMonitor({
    apiBase,
    intervalMs,
    enabled,
    empresaId,        // ya filtra por empresa en el polling
    localidadId,
    onIncidentDetected: handleNewIncident,
  });

  const activeCount = Array.isArray(activeIncidents) ? activeIncidents.length : 0;

  const handleResolve = useCallback(
    async (incident: IncidenteEmergente, comments?: string) => {
      try {
        const response = await fetch(`${apiBase}/incidentes/${incident.id}/resuelto`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ estado: "RESUELTO", comentario: comments }),
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        setProcessedIncidents((prev) => new Set(prev).add(incident.id));
        setIsModalOpen(false);
        setCurrentIncident(null);
        onIncidentResolved?.(incident);
      } catch (err) {
        console.error("Error al resolver incidente:", err);
        alert("No se pudo resolver el incidente. Inténtalo de nuevo.");
      }
    },
    [apiBase, onIncidentResolved]
  );

  const handleSkip = useCallback(
    async (incident: IncidenteEmergente) => {
      try {
        const response = await fetch(`${apiBase}/incidentes/${incident.id}/cerrar`, {
          method: "POST",
          headers: { ...getAuthHeaders() },
          credentials: "include",
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        setProcessedIncidents((prev) => new Set(prev).add(incident.id));
        setIsModalOpen(false);
        setCurrentIncident(null);
        onIncidentSkipped?.(incident);
      } catch (err) {
        console.error("Error al omitir incidente:", err);
        alert("No se pudo omitir el incidente. Inténtalo de nuevo.");
      }
    },
    [apiBase, onIncidentSkipped]
  );

  const handleContinue = useCallback(
    (incident: IncidenteEmergente) => {
      setProcessedIncidents((prev) => new Set(prev).add(incident.id));
      setIsModalOpen(false);
      setCurrentIncident(null);
      onIncidentContinued?.(incident);
    },
    [onIncidentContinued]
  );

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setCurrentIncident(null);
  }, []);

  useEffect(() => {
    setProcessedIncidents(new Set());
  }, [empresaId, localidadId]);

  return (
    <>
      {currentIncident && (
        <IncidentModal
          incident={currentIncident}
          isOpen={isModalOpen}
          onClose={handleClose}
          onResolve={handleResolve}
          onSkip={handleSkip}
          onContinue={handleContinue}
        />
      )}

      {!isMobile && (
        <div className="fixed bottom-4 right-4 z-[1040] rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 text-xs max-w-xs border border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="space-y-2">
            <div className="font-semibold text-emerald-600 dark:text-green-400">🔍 Monitor de Incidentes</div>
            <div>Estado: {isMonitoring ? "Activo" : "Inactivo"}</div>
            <div>Última verificación: {lastCheck?.toLocaleTimeString() || "Nunca"}</div>
            <div>Incidentes activos: {activeIncidents.length}</div>
            {error && <div className="text-red-600 dark:text-red-400">❌ Error: {String(error)}</div>}
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Empresa: {empresaId || "Todas"} | Localidad: {localidadId || "Todas"}
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <>
          <button
            type="button"
            aria-label={isSheetOpen ? "Ocultar monitor de incidentes" : `Mostrar monitor de incidentes${activeCount > 0 ? ` (${activeCount} activos)` : ""}`}
            aria-expanded={isSheetOpen}
            aria-controls="incident-monitor-sheet"
            onClick={() => setIsSheetOpen((v) => !v)}
            className={`fixed right-4 bottom-4 z-[1030] grid place-items-center w-14 h-14 rounded-full bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.18)] border border-slate-200 dark:border-slate-700 transition-transform ${isSheetOpen ? "scale-95" : "scale-100"}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z" fill="currentColor" />
            </svg>
            {activeCount > 0 && (
              <span
                aria-label={`${activeCount} incidentes activos`}
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center shadow ring-1 ring-white dark:ring-slate-900"
              >
                {activeCount > 99 ? "99+" : activeCount}
              </span>
            )}
          </button>

          {isSheetOpen && (
            <div className="fixed inset-0 z-[1035] bg-black/40 backdrop-blur-[2px]" role="presentation" onClick={() => setIsSheetOpen(false)}>
              <section
                id="incident-monitor-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Monitor de Incidentes"
                className="fixed bottom-0 inset-x-0 z-[1040] bg-white dark:bg-slate-900 rounded-t-2xl shadow-[0_-12px_32px_rgba(0,0,0,0.35)] max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">Monitor de Incidentes</span>
                    {isMonitoring ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Activo
                      </span>
                    ) : null}
                  </div>
                  <button type="button" className="px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar monitor de incidentes" onClick={() => setIsSheetOpen(false)}>
                    ✕
                  </button>
                </div>

                <div className="px-4 py-3 overflow-auto text-sm text-slate-700 dark:text-slate-200">
                  <div className="space-y-1">
                    <div><span className="font-medium">Última verificación:</span> {lastCheck?.toLocaleTimeString() || "Nunca"}</div>
                    <div><span className="font-medium">Incidentes activos:</span> {activeIncidents.length}</div>
                    {error && <div className="text-red-600 dark:text-red-400">❌ Error: {String(error)}</div>}
                  </div>

                  {activeIncidents.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Incidentes activos</div>
                      <ul className="space-y-2">
                        {activeIncidents.map((it: any) => (
                          <li key={it.id ?? Math.random()} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="font-medium">#{it.id ?? "—"} {it.titulo ?? it.nombre ?? it.tipo ?? ""}</div>
                            {it.descripcion && <div className="text-slate-600 dark:text-slate-400 text-xs mt-0.5 line-clamp-2">{it.descripcion}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">El monitor permanece en segundo plano. Solo abrirá el modal si el incidente pertenece a tu empresa.</p>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
