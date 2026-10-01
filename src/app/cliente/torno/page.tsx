import { Suspense } from "react";
import { getVerifiedSession } from "@/lib/server/session";
import { normalizeTornoRole } from "@/features/torno/lib/permissions";
import { redirect } from "next/navigation";
import TornoModule from "@/features/torno/components/TornoModule";
import { isClienteAreaRole } from "@/lib/torreonLocalidad";
import { isTornoModuleEnabled } from "@/lib/tornoFeature";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isTornoModuleEnabled) redirect("/cliente");
  const session = await getVerifiedSession();
  if (!session) redirect("/login?loc=cliente");
  const role = session.role;
  if (!isClienteAreaRole(role)) redirect("/");
  if (session.empresaId == null || (session.authorization.scope.mode === "COMPANY_LOCALITY" && session.localidadId == null)) redirect("/login?loc=cliente");

  return (
    <Suspense fallback={<div className="h-28 animate-pulse rounded-md border border-slate-200 bg-white" />}>
      <TornoModule roleHint={normalizeTornoRole(role)} initialSession={{ id: session.userId, rol: role, empresaId: session.empresaId, localidadId: session.localidadId }} />
    </Suspense>
  );
}
