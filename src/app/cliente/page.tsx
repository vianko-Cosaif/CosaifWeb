// src/app/cliente/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ClientPageWrapper from "./ClientPageWrapper";

export const dynamic = "force-dynamic";

type SP = { loc?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const c = await cookies();
  const token = c.get("token")?.value;
  if (!token) redirect("/login?loc=cliente");

  const { loc } = await searchParams;
  const qLoc = Array.isArray(loc) ? loc[0] : loc;

  const localidadId = toInt(qLoc) ?? toInt(c.get("locId")?.value) ?? null;
  const empresaId  = toInt(c.get("empresaId")?.value) ?? null;

  return (
    <section className="w-full">
      <Suspense
        fallback={
          <div className="h-32 rounded-2xl border-2 border-slate-200 bg-white animate-pulse shadow-sm" />
        }
      >
        <ClientPageWrapper localidadId={localidadId} empresaId={empresaId} />
      </Suspense>
    </section>
  );
}

function toInt(x?: string | null): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}
