// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <MovimientosPanel apiBase="/xapi" allowCreate role="COORDINADOR" />
    </section>
  );
}
