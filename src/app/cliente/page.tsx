// src/app/cliente/page.tsx
import { cookies } from "next/headers";
import SelectLocalidad from "@/app/Components/cliente/SelectLocalidad";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

type SP = { loc?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    redirect("/login?loc=cliente");
  }
  const { loc } = await searchParams;
  const c = await cookies(); // Next 15: APIs dinámicas deben awaited

  const qLoc = Array.isArray(loc) ? loc[0] : loc;
  const localidadId = toInt(qLoc) ?? toInt(c.get("locId")?.value) ?? null;

  const RailQueueBoard = (await import("./RailQueueBoard")).default;

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      {localidadId ? <RailQueueBoard localidadId={localidadId} /> : <SelectLocalidad />}
    </section>
  );
}

function toInt(x?: string | null): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}
