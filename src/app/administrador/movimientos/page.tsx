// src/app/administrador/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) redirect("/login?loc=admin");

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <MovimientosPanel
        apiBase={MOVIMIENTOS_API_BASE}
        rol="ADMINISTRADOR"
        empresaIdUsuario={null}      // <— front NO limita por empresa
        puedeCrear
        intervaloAutoMs={15000}
      />
    </section>
  );
}
