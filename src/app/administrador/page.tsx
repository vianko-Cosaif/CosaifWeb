// src/app/admin/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import RailQueueBoardAdmin from "../../features/rail-queue/administrador/RailQueueBoardAdmin";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await cookies();
  const token = c.get("token")?.value;
  const role = c.get("role")?.value?.toUpperCase();
  if (!token) redirect("/login?loc=admin");
  if (role !== "ADMINISTRADOR") redirect("/");

  return (
    <div className="min-h-svh md:min-h-dvh bg-[var(--app-bg)] text-[var(--app-text)]">
      <section className="mx-auto w-full max-w-screen-2xl px-2 py-2 sm:px-4 sm:py-4 lg:px-6">
        <RailQueueBoardAdmin />
      </section>
    </div>
  );
}
