// src/app/admin/layout.tsx
"use client";

import AdaptiveAppShell from "@/components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/features/incidentes/monitor/ScopedIncidentMonitor";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdaptiveAppShell beforeMain={<ScopedIncidentMonitor scope="admin" intervalMs={60000} />}>
      {children}
    </AdaptiveAppShell>
  );
}
