"use client";

import AdaptiveAppShell from "@/app/Components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/app/Components/IncidentModal/ScopedIncidentMonitor";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdaptiveAppShell
      beforeMain={
        <ScopedIncidentMonitor scope="cliente" intervalMs={60000} autoOpenNewIncidents={true} />
      }
    >
      {children}
    </AdaptiveAppShell>
  );
}
