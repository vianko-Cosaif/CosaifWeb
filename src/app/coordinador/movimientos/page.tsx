// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) redirect("/login");

  const empIdCookie =
    Number(c.get("empId")?.value ?? "") ||
    Number(c.get("empresaId")?.value ?? "") ||
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
          empresaIdUsuario={empIdCookie}
          puedeCrear
          intervaloAutoMs={15000}
        />
      </div>
    </section>
  );
}
