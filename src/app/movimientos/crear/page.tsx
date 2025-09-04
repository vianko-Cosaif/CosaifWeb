// app/movimientos/crear/page.tsx
import type { Metadata } from "next";
import CrearMovimiento from "./CrearMovimiento";

export const metadata: Metadata = {
  title: "Crear movimiento | Cosaif",
  description: "Formulario para crear un nuevo movimiento",
};

export default function Page() {
  return <CrearMovimiento />;
}
