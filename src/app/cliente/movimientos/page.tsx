// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  const role = session.role;
  const capabilities = session.authorization.capabilities;
  if (role === "ARRASTRE_TORREON") {
    redirect("/cliente/torreon/movimientos");
  }
  if (session.empresaId == null || (session.authorization.scope.mode === "COMPANY_LOCALITY" && session.localidadId == null)) redirect("/login?loc=cliente");

  return (
    <section
      className="
        w-full min-h-[calc(100svh-4rem)]
        overflow-x-hidden overscroll-y-auto
        touch-pan-y
      "
    >
      <div
        className="
          mx-auto w-full
          max-w-screen-2xl
          px-3 sm:px-4 lg:px-6
          py-2 sm:py-4
        "
      >
        <MovimientosPanel
          apiBase={MOVIMIENTOS_API_BASE}
          rol={role}
          empresaIdUsuario={session.empresaId}
          localidadIdUsuario={session.localidadId}
          bloquearLocalidad={session.authorization.scope.mode === "COMPANY_LOCALITY"}
          puedeCrear={capabilities.canCreateMovements}
          intervaloAutoMs={15000}
        />
      </div>
    </section>
  );
}
