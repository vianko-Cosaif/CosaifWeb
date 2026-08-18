import { redirect } from "next/navigation";
import IncidenteController from "@/app/incidentes/ui/IncidenteController";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.authorization.capabilities.area !== "cliente" || !hasPermission(session.authorization, PERMISSIONS.INCIDENTS_READ)) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="w-full">
        <div className="mx-auto max-w-screen-2xl px-3 pb-6 sm:px-6" style={{ paddingTop: "3.5rem" }}>
          <section className="rounded-2xl border bg-card text-card-foreground shadow-sm">
            <IncidenteController />
          </section>
        </div>
      </div>
    </div>
  );
}
