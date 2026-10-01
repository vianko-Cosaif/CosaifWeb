import "server-only";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/server/session";
import { getPrimaryTorreonLocalidadId, isTorreonLocalidadId } from "@/lib/torreonLocalidad";

/** Resolve the signed client scope once for every arrastre page. */
export async function requireTorreonArrastreClient(otherRoleDestination: string) {
  const session = await getVerifiedSession();
  if (!session || session.authorization.capabilities.area !== "cliente")
    redirect("/login?loc=cliente");
  if (session.role !== "ARRASTRE_TORREON") redirect(otherRoleDestination);

  const localidadId =
    session.authorization.capabilities.canSwitchLocalidad &&
    !isTorreonLocalidadId(session.localidadId)
      ? getPrimaryTorreonLocalidadId()
      : session.localidadId;
  if (!localidadId || !isTorreonLocalidadId(localidadId)) redirect("/cliente");

  return { session, localidadId, empresaId: session.empresaId };
}
