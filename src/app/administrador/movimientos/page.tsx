// src/app/administrador/movimientos/page.tsx
import CoordinatorMovimientosPageClient from "@/app/coordinador/movimientos/CoordinatorMovimientosPageClient";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.role !== "ADMINISTRADOR") redirect("/login?loc=admin");

  return (
    <section className="mx-auto w-full max-w-[1500px] p-4 sm:p-6">
      <CoordinatorMovimientosPageClient
        apiBase={MOVIMIENTOS_API_BASE}
        rol="ADMINISTRADOR"
        empresaIdUsuario={null}
        localidadIdUsuario={null}
      />
    </section>
  );
}
