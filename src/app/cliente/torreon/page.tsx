import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { requireTorreonArrastreClient } from "@/lib/server/torreonArrastreClient";
import ClientPageWrapper from "../../../features/cliente/ClientPageWrapper";
import TorreonClientePanel from "../../../features/torreon/cliente/TorreonClientePanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { session, localidadId, empresaId } = await requireTorreonArrastreClient("/cliente");

  if (!hasPermission(session.authorization, PERMISSIONS.TORREON_READ)) {
    return <ClientPageWrapper localidadId={localidadId} empresaId={empresaId} />;
  }

  return (
    <TorreonClientePanel
      localidadId={localidadId}
      empresaId={empresaId}
      role={session.role}
      view="dashboard"
    />
  );
}
