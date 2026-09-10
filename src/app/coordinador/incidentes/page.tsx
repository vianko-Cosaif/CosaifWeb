import { getVerifiedSession } from "@/lib/server/session";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import {redirect} from "next/navigation"
import IncidenteController from "@/features/incidentes/operacion/IncidenteController"

export const dynamic = "force-dynamic"; 

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.role !== "COORDINADOR" || !hasPermission(session.authorization, PERMISSIONS.INCIDENTS_READ)) redirect("/login");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="w-full">
        <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 pb-6" style={{ paddingTop: "3.5rem" }}>
          <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <IncidenteController authorization={session.authorization} />
          </section>
        </div>
      </div>
    </div>
  );
}
