import { redirect } from "next/navigation";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { requireTorreonArrastreClient } from "@/lib/server/torreonArrastreClient";
import TorreonClientePanel from "../../../../features/torreon/cliente/TorreonClientePanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { session, localidadId, empresaId } =
    await requireTorreonArrastreClient("/movimientos/crear");

  if (!hasPermission(session.authorization, PERMISSIONS.TORREON_CREATE)) {
    redirect("/movimientos/crear");
  }

  return (
    <TorreonClientePanel
      localidadId={localidadId}
      empresaId={empresaId}
      role={session.role}
      view="crear"
    />
  );
}
