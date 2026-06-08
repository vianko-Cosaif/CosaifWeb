// src/app/admin/layout.tsx
"use client";

import AdaptiveAppShell from "@/app/Components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/app/Components/IncidentModal/ScopedIncidentMonitor";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdaptiveAppShell beforeMain={<ScopedIncidentMonitor scope="admin" intervalMs={60000} />}>
      {children}
    </AdaptiveAppShell>
  );
}
