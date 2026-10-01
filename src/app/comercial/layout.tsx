import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdaptiveAppShell from "@/components/layout/AdaptiveAppShell";
import CommercialDataProvider from "../../features/comercial/components/CommercialDataProvider";
import "../../features/comercial/commercial.css";

export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const bag = await cookies();
  const token = bag.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  const role = bag.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase();
  if (!token) redirect("/login");
  if (role !== "COMERCIAL") redirect("/");
  return <AdaptiveAppShell><CommercialDataProvider><div className="commercial-page">{children}</div></CommercialDataProvider></AdaptiveAppShell>;
}
