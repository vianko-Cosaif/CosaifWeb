// app/movimientos/crear/page.tsx
import type { Metadata } from "next";
import CrearMovimiento from "./CrearMovimiento";
import { redirect } from "next/navigation";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Crear movimiento | Cosaif",
  description: "Formulario para crear un nuevo movimiento",
};

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login?loc=cliente");
  if (session.role === "ARRASTRE_TORREON") {
    redirect("/cliente/torreon/crear");
  }
  if (!hasPermission(session.authorization, PERMISSIONS.MOVEMENTS_CREATE)) redirect(session.authorization.capabilities.home);

  return <CrearMovimiento />;
}
