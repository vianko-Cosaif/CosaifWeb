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
    const token = (await cookies()).get("token")?.value;
    if (!token) {
      redirect("/login?loc=cliente");
    }
  return <CrearMovimiento />;
}
