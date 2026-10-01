import AdaptiveAppShell from "@/components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/features/incidentes/monitor/ScopedIncidentMonitor";

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
