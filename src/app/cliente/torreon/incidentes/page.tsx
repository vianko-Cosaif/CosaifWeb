import { redirect } from "next/navigation";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { requireTorreonArrastreClient } from "@/lib/server/torreonArrastreClient";
import TorreonClientePanel from "../../../../features/torreon/cliente/TorreonClientePanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { session, localidadId, empresaId } =
    await requireTorreonArrastreClient("/cliente/incidentes");

  if (!hasPermission(session.authorization, PERMISSIONS.INCIDENTS_READ)) {
    redirect("/cliente/movimientos");
  }

  return (
    <TorreonClientePanel
      localidadId={localidadId}
      empresaId={empresaId}
      role={session.role}
      view="incidentes"
    />
  );
}
