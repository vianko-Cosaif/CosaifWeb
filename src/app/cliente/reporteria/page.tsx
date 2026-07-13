import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ClienteReporteriaClient from "./ClienteReporteriaClient";
import { isClienteAreaRole } from "@/lib/torreonLocalidad";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  const role = c.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase();

  if (!token) redirect("/login?loc=cliente");
  if (!isClienteAreaRole(role)) redirect("/");

  return (
    <Suspense fallback={<div className="h-40 rounded-2xl border border-slate-200 bg-white/80 shadow-sm" />}>
      <ClienteReporteriaClient />
    </Suspense>
  );
}
