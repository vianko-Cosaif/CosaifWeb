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
    <main className="min-h-svh md:min-h-dvh bg-slate-50 dark:bg-neutral-950">
      <section
        className="
          mx-auto w-full max-w-screen-2xl
          px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20
          py-6 sm:py-8 md:py-12 lg:py-16
          pt-[calc(env(safe-area-inset-top)+1rem)]
          pb-[calc(env(safe-area-inset-bottom)+1rem)]
          overscroll-y-auto touch-pan-y
        "
      >
        {/* Layout más espacioso y responsive */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,120ch)_1fr] gap-8">
          <div className="xl:col-start-2">
            <Suspense fallback={
              <div className="h-32 rounded-2xl border-2 border-slate-200 bg-white animate-pulse shadow-sm" />
            }>
              <ClientPageWrapper localidadId={localidadId} empresaId={empresaId} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}

function toInt(x?: string | null): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}