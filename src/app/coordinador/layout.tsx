// src/app/coordinador/layout.tsx
"use client";

import AdaptiveAppShell from "@/app/Components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/app/Components/IncidentModal/ScopedIncidentMonitor";

export default function CoordinadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdaptiveAppShell
      beforeMain={<ScopedIncidentMonitor scope="localidad" intervalMs={60000} />}
      footerClassName="text-[var(--app-text-soft)]"
    >
      {children}
    </AdaptiveAppShell>
  );
}
