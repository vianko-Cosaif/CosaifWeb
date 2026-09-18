import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Shared FCM links land in the signed-in user's movement area. */
export default async function MovementNotificationEntry() {
  const session = await getVerifiedSession();
  if (!session || !session.authorization.capabilities.canUseWeb) redirect("/login");
  if (session.role === "ARRASTRE_TORREON") redirect("/cliente/torreon/movimientos");
  const area = session.authorization.capabilities.area;
  if (["cliente", "coordinador", "supervisor", "administrador"].includes(area)) {
    redirect(`/${area}/movimientos`);
  }
  redirect(session.authorization.capabilities.home);
}
