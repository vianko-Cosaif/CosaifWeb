import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import IncidenteController from "@/app/incidentes/ui/IncidenteController";
import { getRoleCapabilities } from "@/lib/accessControl";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) redirect("/login?loc=cliente");

  const role = cookieStore.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase() ?? "CLIENTE";
  const capabilities = getRoleCapabilities(role);

  if (capabilities.area !== "cliente") {
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
