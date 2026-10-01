import type { Metadata } from "next";
import LoginScreen from "@/features/auth/LoginScreen";

export const metadata: Metadata = { title: "Iniciar sesión", description: "Accede a COSAIF Logistics para coordinar rondas, movimientos y operación ferroviaria." };

export default function Page() {
  return <LoginScreen />;
}

