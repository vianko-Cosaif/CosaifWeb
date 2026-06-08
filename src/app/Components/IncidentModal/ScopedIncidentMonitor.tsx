"use client";

import { useEffect, useState } from "react";
import { getClientCookie, getEmpresaIdClient, getLocIdClient, getRoleClient } from "@/lib/cookies";
import IncidentMonitor from "./IncidentMonitor";

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

  useEffect(() => {
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
      return;
    }

    if (resolvedScope === "cliente") {
      setEmpresaId(getEmpresaIdClient());
      setLocalidadId(getStoredLocalidadId());
      return;
    }

    setEmpresaId(null);
    setLocalidadId(getStoredLocalidadId());
  }, [scope]);

  return (
    <IncidentMonitor
      apiBase="/bff"
      intervalMs={intervalMs}
      enabled={true}
      empresaId={empresaId}
      localidadId={localidadId}
      autoOpenNewIncidents={autoOpenNewIncidents}
    />
  );
}
