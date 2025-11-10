// src/app/admin/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import RailQueueBoardAdmin from "./RailQueueBoardAdmin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await cookies();
  const token = c.get("token")?.value;
  const role  = c.get("role")?.value?.toUpperCase();
  if (!token) redirect("/login?loc=admin");
  if (role !== "ADMINISTRADOR") redirect("/");

  return (
    <main className="min-h-svh md:min-h-dvh bg-slate-50 dark:bg-neutral-950">
      <section className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-6 sm:py-8 md:py-12 lg:py-16 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <RailQueueBoardAdmin />
      </section>
    </main>
  );
}
