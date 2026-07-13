import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) redirect("/login?loc=cliente");

  redirect("/cliente");
}
