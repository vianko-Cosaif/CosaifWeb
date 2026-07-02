// app/movimientos/crear/page.tsx
import type { Metadata } from "next";
import CrearMovimiento from "./CrearMovimiento";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Crear movimiento | Cosaif",
  description: "Formulario para crear un nuevo movimiento",
};

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  if (!token) {
    redirect("/login?loc=cliente");
  }

  const role = cookieStore.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value?.toUpperCase() ?? "";
  if (role === "ARRASTRE_TORREON") {
    redirect("/cliente/torreon/crear");
  }

  return <CrearMovimiento />;
}
