// src/app/cliente/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import IncidenteController from "./ui/IncidenteController";
import Menu from "@/app/Components/Menu/Menu";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = cookies();
  const token = (await c).get("token")?.value;
  const role = (await c).get("role")?.value?.toUpperCase() ?? "";
  if (!token) redirect("/login?loc=cliente");

  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      {/* Sidebar/Topbar (se encarga de su propio spacer en desktop) */}
      <Menu rol={role} />

      <main id="content" className="w-full">
        <div
          className={[
            // ancho fluido y márgenes
            "mx-auto w-full max-w-screen-2xl",
            // padding horizontal por breakpoint
            "px-3 sm:px-4 md:px-6 lg:px-8",
            // compensar header móvil + safe-area
            "pt-[max(3.5rem,calc(env(safe-area-inset-top)+3.25rem))] md:pt-6",
            // espacio inferior y safe-area
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
          ].join(" ")}
        >
          {/* Contenedor principal: padding adaptable */}
          <section className="rounded-2xl border bg-card text-card-foreground shadow-sm p-3 sm:p-4 md:p-6">
            <IncidenteController />
          </section>

          {/* Grid extensible si agregas más tarjetas */}
          {/* <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-2xl border bg-card p-3 sm:p-4 md:p-6 shadow-sm" />
            <section className="rounded-2xl border bg-card p-3 sm:p-4 md:p-6 shadow-sm" />
            <section className="rounded-2xl border bg-card p-3 sm:p-4 md:p-6 shadow-sm" />
          </div> */}
        </div>
      </main>
    </div>
  );
}
