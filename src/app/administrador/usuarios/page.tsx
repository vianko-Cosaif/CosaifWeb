import { cookies } from "next/headers";
import { UsuariosPageClient } from "@/features/usuarios";

export default async function Usuarios() {
  const cookieStore = await cookies();
  const role = cookieStore.get(process.env.ROLE_COOKIE_NAME || "role")?.value || "ADMINISTRADOR";
  const localidadId = Number(cookieStore.get("locId")?.value || cookieStore.get("localidadId")?.value || 0);

  return (
    <UsuariosPageClient
      apiBase="/bff"
      sessionRole={role}
      sessionLocalidadId={Number.isFinite(localidadId) && localidadId > 0 ? localidadId : null}
    />
  );
}
