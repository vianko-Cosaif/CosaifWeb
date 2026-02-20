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

  if (empIdCookie == null) {
    redirect("/login?loc=cliente");
  }

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
          max-w-7xl
          px-3 sm:px-4 lg:px-6
          py-2 sm:py-4
        "
      >
        <MovimientosPanel
          apiBase="/bff"
          rol="CLIENTE"
          token={token}
          empresaIdUsuario={empIdCookie}
          puedeCrear
          intervaloAutoMs={15000}
        />
      </div>
    </section>
  );
}
