// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

  if (empIdCookie == null) {
    redirect("/login");
  }

  return (
    // Contenedor de página: no permite scroll horizontal global
    <section className="w-full min-h-screen overflow-x-hidden">
      {/* Contenedor centrado del panel */}
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 lg:px-6">
        <MovimientosPanel
          apiBase="/bff"
          rol="COORDINADOR"
          token={token}
          empresaIdUsuario={empIdCookie}
          localidadIdUsuario={locIdCookie}
          puedeCrear
          intervaloAutoMs={15000}
        />
      </div>
    </section>
  );
}
