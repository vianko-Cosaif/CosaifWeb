// src/app/administrador/movimientos/page.tsx
import CoordinatorMovimientosPageClient from "@/app/coordinador/movimientos/CoordinatorMovimientosPageClient";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) redirect("/login?loc=admin");

  return (
    <section className="mx-auto w-full max-w-[1500px] p-4 sm:p-6">
      <CoordinatorMovimientosPageClient
        apiBase={MOVIMIENTOS_API_BASE}
        token={token}
        rol="ADMINISTRADOR"
        empresaIdUsuario={null}
        localidadIdUsuario={null}
      />
    </section>
  );
}
