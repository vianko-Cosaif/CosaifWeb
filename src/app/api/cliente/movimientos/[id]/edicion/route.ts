import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getRoleCapabilities } from "@/lib/accessControl";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";

export const dynamic = "force-dynamic";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);

function positiveNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!ORIGIN) {
    return NextResponse.json({ message: "API_ORIGIN no configurado." }, { status: 500 });
  }

  const { id } = await context.params;
  const movementId = positiveNumber(id);
  if (!movementId) {
    return NextResponse.json({ message: "Movimiento invalido." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME ?? "token")?.value;
  const role = String(cookieStore.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value || "").toUpperCase();
  const capabilities = getRoleCapabilities(role);
  const assignedEmpresaId = positiveNumber(cookieStore.get("empresaId")?.value);
  const assignedLocalidadId = positiveNumber(
    cookieStore.get("locId")?.value,
    cookieStore.get("localidadId")?.value,
  );

  if (!token) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (!capabilities.isClientLike) {
    return NextResponse.json({ message: "Ruta exclusiva para clientes." }, { status: 403 });
  }
  if (!assignedEmpresaId) {
    return NextResponse.json({ message: "No hay una empresa asignada a la sesion." }, { status: 403 });
  }

  const upstream = await fetch(`${ORIGIN}/movimientos/${encodeURIComponent(String(movementId))}/edicion`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await upstream.text();

  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Respuesta invalida del backend." }, { status: 502 });
  }

  const root = asRecord(payload);
  const movement = asRecord(root.movimiento ?? root);
  const company = asRecord(movement.empresa);
  const locality = asRecord(movement.localidad);
  const movementEmpresaId = positiveNumber(movement.empresaId, company.id);
  const movementLocalidadId = positiveNumber(movement.localidadId, locality.id);

  if (movementEmpresaId !== assignedEmpresaId) {
    return NextResponse.json({ message: "Solo puedes ver mediciones de tus locomotoras." }, { status: 403 });
  }
  if (role === "CLIENTE" && assignedLocalidadId && movementLocalidadId !== assignedLocalidadId) {
    return NextResponse.json({ message: "Solo puedes ver mediciones de tu localidad." }, { status: 403 });
  }

  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
