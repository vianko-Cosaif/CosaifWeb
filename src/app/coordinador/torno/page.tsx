import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TornoModule from "@/app/torno/components/TornoModule";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const role = cookieStore.get("role")?.value?.toUpperCase();

  if (!token) redirect("/login?loc=coordinador");
  if (role && role !== "COORDINADOR") redirect("/");

  return (
    <Suspense fallback={<div className="h-28 animate-pulse rounded-md border border-slate-200 bg-white" />}>
      <TornoModule roleHint="COORDINADOR" />
    </Suspense>
  );
}
