import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ComercialPage() {
  redirect("/comercial/reporte-general");
}
