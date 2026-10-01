import { UsuariosPageClient } from "@/features/usuarios";
import { redirect } from "next/navigation";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export default async function Usuarios() {
  const session = await getVerifiedSession();
  if (!session || session.role !== "ADMINISTRADOR" || !hasPermission(session.authorization, PERMISSIONS.USERS_READ)) redirect("/");

  return (
    <UsuariosPageClient
      apiBase="/bff"
      sessionRole={session.role}
      sessionLocalidadId={session.localidadId}
    />
  );
}
