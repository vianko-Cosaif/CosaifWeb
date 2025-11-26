import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EditarMovimiento from "./EditarMovimiento";

export const dynamic = "force-dynamic";

interface PageProps {
  // Next está esperando un Promise aquí
  searchParams: Promise<{ id?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  // cookies() en Next 15 es async, esto está bien
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;

  if (!token) {
    redirect("/login?loc=cliente");
  }

  const empIdCookie =
    Number(c.get("empId")?.value ?? "") ||
    Number(c.get("empresaId")?.value ?? "") ||
    null;

  if (empIdCookie == null) {
    redirect("/login?loc=cliente");
  }

  // Resolvem​os el Promise de searchParams
  const { id: idStr } = await searchParams;
  const id = Number(idStr ?? "");

  if (!id) {
    redirect("/cliente/movimientos");
  }

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <EditarMovimiento movimientoId={id} />
    </section>
  );
}
