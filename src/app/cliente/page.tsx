// src/app/cliente/page.tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ClientPageWrapper from "./ClientPageWrapper";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

type SP = { loc?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getVerifiedSession();
  if (!session || session.authorization.capabilities.area !== "cliente") redirect("/login?loc=cliente");

  const { loc } = await searchParams;
  const qLoc = Array.isArray(loc) ? loc[0] : loc;

  const assignedLocalidadId = session.localidadId;
  const empresaId = session.empresaId;
  const role = session.role;
  const capabilities = session.authorization.capabilities;
  const effectiveLocalidadId = capabilities.canSwitchLocalidad
    ? toInt(qLoc) ?? assignedLocalidadId
    : assignedLocalidadId;

  if (!capabilities.canSwitchLocalidad && isTorreonLocalidadId(assignedLocalidadId)) {
    redirect("/cliente/torreon");
  }

  return (
    <section className="w-full">
      <Suspense
        fallback={
          <div className="h-32 rounded-2xl border-2 border-slate-200 bg-white animate-pulse shadow-sm" />
        }
      >
        <ClientPageWrapper localidadId={effectiveLocalidadId} empresaId={empresaId} role={role} />
      </Suspense>
    </section>
  );
}

function toInt(x?: string | null): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}
