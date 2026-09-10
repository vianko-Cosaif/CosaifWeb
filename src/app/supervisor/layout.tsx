// src/app/supervisor/layout.tsx
"use client";

import AdaptiveAppShell from "@/components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/features/incidentes/monitor/ScopedIncidentMonitor";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdaptiveAppShell
      beforeMain={<ScopedIncidentMonitor scope="localidad" intervalMs={60000} />}
    >
      {children}
    </AdaptiveAppShell>
  );
}
