// src/app/supervisor/layout.tsx
"use client";

import AdaptiveAppShell from "@/app/Components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/app/Components/IncidentModal/ScopedIncidentMonitor";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdaptiveAppShell
      beforeMain={<ScopedIncidentMonitor scope="localidad" intervalMs={60000} />}
      backgroundClassName="bg-gradient-to-b from-violet-50 via-slate-50 to-slate-100 dark:from-[#050014] dark:via-[#050018] dark:to-black"
      gridClassName="bg-[linear-gradient(to_right,rgba(88,28,135,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(88,28,135,0.07)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.10]"
    >
      {children}
    </AdaptiveAppShell>
  );
}
