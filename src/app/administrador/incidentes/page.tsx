import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminIncidentCenter from "@/features/incidentes/AdminIncidentCenter";

export const dynamic = "force-dynamic";

export default async function AdministradorIncidentesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
  const role = cookieStore.get(process.env.ROLE_COOKIE_NAME || "role")?.value?.toUpperCase();

  if (!token) redirect("/login?loc=administrador");
  if (role !== "ADMINISTRADOR") redirect("/");

  return <AdminIncidentCenter />;
}
