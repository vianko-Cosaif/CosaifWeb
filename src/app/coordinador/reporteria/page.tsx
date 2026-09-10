import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/server/session";
import ReporteriaCoorClient from "../../../features/reporteria/coordinador/reporteria-coor-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getVerifiedSession();
  if (!session || session.role !== "COORDINADOR" || session.localidadId == null) redirect("/login?loc=coordinador");

  return (
    <section className="mx-auto w-full max-w-none min-w-0 overflow-x-hidden px-4 xl:px-8">
      <ReporteriaCoorClient localidadId={session.localidadId} />
    </section>
  );
}
