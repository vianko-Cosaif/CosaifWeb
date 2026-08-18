import { redirect } from "next/navigation";
import { getPrimaryTorreonLocalidadId, isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";
import ClientPageWrapper from "../ClientPageWrapper";
import TorreonClientePanel from "./TorreonClientePanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.authorization.capabilities.area !== "cliente") redirect("/login?loc=cliente");
  const role = session.role;
  const capabilities = session.authorization.capabilities;
  const localidadId = capabilities.canSwitchLocalidad && !isTorreonLocalidadId(session.localidadId)
    ? getPrimaryTorreonLocalidadId()
    : session.localidadId;
  const empresaId = session.empresaId;

  if (!localidadId || !isTorreonLocalidadId(localidadId)) {
    redirect("/cliente");
  }

  if (!hasPermission(session.authorization, PERMISSIONS.TORREON_READ)) {
    return <ClientPageWrapper localidadId={localidadId} empresaId={empresaId} />;
  }

  return <TorreonClientePanel localidadId={localidadId} empresaId={empresaId} role={role} view="dashboard" />;
}
