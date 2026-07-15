// src/app/cliente/page.tsx  (SERVER component)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import IncidenteController from "../../incidentes/ui/IncidenteController";

export const dynamic = "force-dynamic"; // opcional

export default async function Page() {
  const c = cookies();
  const token = (await c).get("token")?.value;

  if (!token) redirect("/login?loc=supervisor");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="w-full">
        <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 pb-6" style={{ paddingTop: "3.5rem" }}>
          <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <IncidenteController />
          </section>
        </div>
      </div>
    </div>
  );
}
