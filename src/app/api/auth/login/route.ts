import { NextResponse } from "next/server";

/**
 * La sesión se crea exclusivamente en /bff/login después de que el backend
 * valida las credenciales. Este endpoint ya no acepta roles o tokens del cliente.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Usa el inicio de sesión seguro" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
