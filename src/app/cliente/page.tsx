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
    <main className="min-h-svh md:min-h-dvh bg-white dark:bg-neutral-950">
      <section
        className="
          mx-auto w-full max-w-screen-2xl
          px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12
          py-3 sm:py-4 md:py-6 lg:py-8
          pt-[env(safe-area-inset-top)]
          pb-[env(safe-area-inset-bottom)]
          overscroll-y-auto touch-pan-y
        "
      >
        {/* Columna fluida y cómoda en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,85ch)_1fr]">
          <div className="lg:col-start-2">
            <Suspense fallback={<div className="h-24 rounded-xl border animate-pulse" />}>
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
