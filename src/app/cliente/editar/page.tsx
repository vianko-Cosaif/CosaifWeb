import { redirect } from "next/navigation";
import EditarMovimiento from "./EditarMovimiento";
import { isTrainingMovementId } from "@/lib/routePolicy";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

interface PageProps {
  // Next está esperando un Promise aquí
  searchParams: Promise<{ id?: string; training?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getVerifiedSession();
  if (!session) redirect("/login?loc=cliente");

  // Resolvem​os el Promise de searchParams
  const { id: idStr, training } = await searchParams;
  const id = Number(idStr ?? "");

  if (!id) {
    redirect("/cliente/movimientos");
  }

  // Los IDs SIM permiten practicar a roles sin empresa asignada, sin relajar
  // el requisito de empId para movimientos productivos.
  const isTrainingMovement = isTrainingMovementId(id);
  if (training === "1" && !isTrainingMovement) {
    // Nunca permitimos convertir un editor de capacitación en uno productivo
    // cambiando únicamente el ID del query string.
    redirect("/cliente/movimientos?trainingError=invalid-sim-id");
  }
  if (!hasPermission(session.authorization, PERMISSIONS.MOVEMENTS_EDIT) && !isTrainingMovement) {
    redirect(session.authorization.capabilities.home);
  }
  if (session.empresaId == null && !isTrainingMovement && session.authorization.scope.mode !== "GLOBAL") {
    redirect("/login?loc=cliente");
  }

  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <EditarMovimiento movimientoId={id} />
    </section>
  );
}
