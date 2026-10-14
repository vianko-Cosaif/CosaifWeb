import AdaptiveAppShell from "@/components/layout/AdaptiveAppShell";
import ScopedIncidentMonitor from "@/features/incidentes/monitor/ScopedIncidentMonitor";
import { getVerifiedSession } from "@/lib/server/session";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const session = await getVerifiedSession();
  const hideBanner = Boolean(session && isTorreonLocalidadId(session.localidadId));
  return (
    <AdaptiveAppShell
      hideBanner={hideBanner}
      beforeMain={
        <ScopedIncidentMonitor scope="cliente" intervalMs={60000} autoOpenNewIncidents={true} />
      }
    >
      {children}
    </AdaptiveAppShell>
  );
}
