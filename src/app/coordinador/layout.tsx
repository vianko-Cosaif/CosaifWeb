// src/app/coordinador/layout.tsx
import AdaptiveAppShell from "@/components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/features/incidentes/monitor/ScopedIncidentMonitor";

export default function CoordinadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdaptiveAppShell
      beforeMain={<ScopedIncidentMonitor scope="localidad" intervalMs={60000} />}
      footerClassName="text-[var(--app-text-soft)]"
    >
      {children}
    </AdaptiveAppShell>
  );
}
