"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getClientCookie, getEmpresaIdClient, getLocIdClient, getRoleClient } from "@/lib/cookies";

const IncidentMonitor = dynamic(() => import("./IncidentMonitor"), { ssr: false });

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_INCIDENT_API_BASE || "/api";

type ScopeMode = "auto" | "cliente" | "localidad" | "admin";

type ScopedIncidentMonitorProps = {
  scope?: ScopeMode;
  intervalMs?: number;
  autoOpenNewIncidents?: boolean;
};

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getStoredLocalidadId(): number | null {
  if (typeof window === "undefined") return null;
  return (
    getLocIdClient() ??
    toPositiveInt(getClientCookie("localidadId")) ??
    toPositiveInt(window.localStorage.getItem("locId")) ??
    toPositiveInt(window.localStorage.getItem("localidadId"))
  );
}

export default function ScopedIncidentMonitor({
  scope = "auto",
  intervalMs = 60000,
  autoOpenNewIncidents = false,
}: ScopedIncidentMonitorProps) {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [localidadId, setLocalidadId] = useState<number | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  const [monitorReady, setMonitorReady] = useState(false);

  useEffect(() => {
    const refreshScope = () => {
      const role = getRoleClient();
      const resolvedScope =
        scope === "auto"
          ? role === "ADMINISTRADOR"
            ? "admin"
            : role === "CLIENTE"
              ? "cliente"
              : "localidad"
          : scope;

      if (resolvedScope === "admin") {
        setEmpresaId(null);
        setLocalidadId(null);
        setScopeReady(true);
        return;
      }

      if (resolvedScope === "cliente") {
        setEmpresaId(getEmpresaIdClient());
        setLocalidadId(getStoredLocalidadId());
        setScopeReady(true);
        return;
      }

      setEmpresaId(null);
      setLocalidadId(getStoredLocalidadId());
      setScopeReady(true);
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "locId" || event.key === "localidadId") refreshScope();
    };

    refreshScope();
    window.addEventListener("storage", onStorage);
    window.addEventListener("cosaif:localidad-change", refreshScope);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cosaif:localidad-change", refreshScope);
    };
  }, [scope]);

  useEffect(() => {
    if (!scopeReady) return;
    const timeoutId = window.setTimeout(() => setMonitorReady(true), 900);
    return () => window.clearTimeout(timeoutId);
  }, [scopeReady]);

  if (!scopeReady || !monitorReady) return null;

  return (
    <IncidentMonitor
      apiBase={DEFAULT_API_BASE}
      intervalMs={intervalMs}
      enabled={true}
      empresaId={empresaId}
      localidadId={localidadId}
      autoOpenNewIncidents={autoOpenNewIncidents}
    />
  );
}
