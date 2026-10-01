import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ReporteriaCoorClient from "../reporteria-coor/reporteria-coor-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await cookies();
  const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  const role = c.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase();

  if (!token) redirect("/login?loc=coordinador");
  if (role !== "COORDINADOR") redirect("/");

  return (
    <section className="mx-auto w-full max-w-none min-w-0 overflow-x-hidden px-4 xl:px-8">
      <ReporteriaCoorClient />
    </section>
  );
}
