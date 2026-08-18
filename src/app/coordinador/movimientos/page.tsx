import { redirect } from "next/navigation";
import CoordinatorMovimientosPageClient from "./CoordinatorMovimientosPageClient";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.role !== "COORDINADOR" || session.localidadId == null) redirect("/login");

  return (
    <CoordinatorMovimientosPageClient
      apiBase={MOVIMIENTOS_API_BASE}
      rol="COORDINADOR"
      empresaIdUsuario={session.empresaId}
      localidadIdUsuario={session.localidadId}
    />
  );
}
