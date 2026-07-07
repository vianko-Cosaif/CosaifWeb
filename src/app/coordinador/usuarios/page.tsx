import { UsuariosPageClient } from "@/features/usuarios";

export default function Usuarios() {
  return <UsuariosPageClient apiBase={process.env.NEXT_PUBLIC_API_BASE || "/bff"} />;
}
