// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRoleCapabilities, normalizeAppRole } from "@/lib/accessControl";

export const dynamic = "force-dynamic";
const MOVIMIENTOS_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default async function Page() {
  const c = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME ?? "token";
  const token = c.get(cookieName)?.value;
  if (!token) redirect("/login");

  const role = normalizeAppRole(c.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value) ?? "CLIENTE";
  const capabilities = getRoleCapabilities(role);
  if (role === "ARRASTRE_TORREON") {
    redirect("/cliente/torreon/movimientos");
  }

  const empIdCookie =
    Number(c.get("empId")?.value ?? "") ||
    Number(c.get("empresaId")?.value ?? "") ||
    null;
  const locIdCookie =
    Number(c.get("locId")?.value ?? "") ||
    Number(c.get("localidadId")?.value ?? "") ||
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
          max-w-screen-2xl
          px-3 sm:px-4 lg:px-6
          py-2 sm:py-4
        "
      >
        <MovimientosPanel
          apiBase={MOVIMIENTOS_API_BASE}
          rol={role}
          token={token}
          empresaIdUsuario={empIdCookie}
          localidadIdUsuario={capabilities.canSwitchLocalidad ? null : locIdCookie}
          puedeCrear
          intervaloAutoMs={15000}
        />
      </div>
    </section>
  );
}
