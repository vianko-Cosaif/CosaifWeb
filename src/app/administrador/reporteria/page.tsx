import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ReporteriaAdminClient from "./reporteria-admin-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  const role = c.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase();

  if (!token) redirect("/login?loc=admin");
  if (role === "COORDINADOR") redirect("/coordinador/reporteria");
  if (role !== "ADMINISTRADOR") redirect("/");

  return (
    <section className="mx-auto w-full max-w-screen-2xl">
      <ReporteriaAdminClient />
    </section>
  );
}
