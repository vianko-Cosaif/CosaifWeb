import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CoordinatorMovimientosPageClient from "./CoordinatorMovimientosPageClient";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const c = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME ?? "token";
  const token = c.get(cookieName)?.value;
  if (!token) redirect("/login");

  const empIdCookie =
    Number(c.get("empId")?.value ?? "") ||
    Number(c.get("empresaId")?.value ?? "") ||
    null;
  const locIdCookie =
    Number(c.get("locId")?.value ?? "") ||
    Number(c.get("localidadId")?.value ?? "") ||
    null;

  if (empIdCookie == null || locIdCookie == null) {
    redirect("/login");
  }

  return (
    <CoordinatorMovimientosPageClient
      apiBase={MOVIMIENTOS_API_BASE}
      token={token}
      rol="COORDINADOR"
      empresaIdUsuario={empIdCookie}
      localidadIdUsuario={locIdCookie}
    />
  );
}
