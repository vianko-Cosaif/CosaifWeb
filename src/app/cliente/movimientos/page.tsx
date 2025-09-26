// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function Page() {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/login?loc=cliente");

  return (
    <section
      className="
        container mx-auto max-w-7xl
        px-3 sm:px-4 md:px-6 lg:px-8
        py-3 sm:py-4 md:py-6 lg:py-8
        min-h-dvh
        pt-[env(safe-area-inset-top)]
        pb-[env(safe-area-inset-bottom)]
        overscroll-y-auto touch-pan-y
      "
    >
      <div className="grid gap-3 sm:gap-4 lg:gap-6">
        <Suspense fallback={<p className="text-sm opacity-70">Cargando…</p>}>
          <MovimientosPanel apiBase="/bff" allowCreate role="COORDINADOR" />
        </Suspense>
      </div>
    </section>
  );
}
