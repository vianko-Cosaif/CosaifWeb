// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.role !== "SUPERVISOR" || session.localidadId == null) redirect("/login");

  return (
    // Contenedor de página: no permite scroll horizontal global
    <section className="w-full min-h-screen overflow-x-hidden">
      {/* Contenedor centrado del panel */}
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 lg:px-6">
        <MovimientosPanel
          apiBase={MOVIMIENTOS_API_BASE}
          rol="SUPERVISOR"
          empresaIdUsuario={session.empresaId}
          localidadIdUsuario={session.localidadId}
          bloquearLocalidad
          puedeCrear={session.authorization.capabilities.canCreateMovements}
          intervaloAutoMs={15000}
        />
      </div>
    </section>
  );
}
