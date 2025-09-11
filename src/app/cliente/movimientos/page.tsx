// src/app/cliente/movimientos/page.tsx
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    redirect("/login?loc=cliente");
  }
export default function Page() {
  
  return (
    
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <MovimientosPanel apiBase="/xapi" allowCreate role="COORDINADOR" />
    </section>
  );
}
