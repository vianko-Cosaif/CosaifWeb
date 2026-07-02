import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canViewTorreonArrastreRole, isClienteAreaRole, isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import ClientPageWrapper from "../ClientPageWrapper";
import TorreonClientePanel from "./TorreonClientePanel";

export const dynamic = "force-dynamic";

function toInt(value?: string | null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) redirect("/login?loc=cliente");

  const role = cookieStore.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase() ?? "";
  const localidadId = toInt(cookieStore.get("locId")?.value) ?? toInt(cookieStore.get("localidadId")?.value);
  const empresaId = toInt(cookieStore.get("empresaId")?.value) ?? toInt(cookieStore.get("empId")?.value);

  if (!isClienteAreaRole(role)) {
    redirect("/");
  }

  if (!localidadId || !isTorreonLocalidadId(localidadId)) {
    redirect("/cliente");
  }

  if (!canViewTorreonArrastreRole(role)) {
    return <ClientPageWrapper localidadId={localidadId} empresaId={empresaId} />;
  }

  return <TorreonClientePanel localidadId={localidadId} empresaId={empresaId} role={role} view="dashboard" />;
}
