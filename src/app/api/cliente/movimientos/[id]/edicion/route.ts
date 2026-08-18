import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { getVerifiedSession } from "@/lib/server/session";

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
  const session = await getVerifiedSession();
  const assignedEmpresaId = session?.empresaId ?? null;
  const assignedLocalidadId = session?.localidadId ?? null;

  if (!token || !session) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  if (!session.authorization.capabilities.isClientLike) {
    return NextResponse.json({ message: "Ruta exclusiva para clientes." }, { status: 403 });
  }
  if (!hasPermission(session.authorization, PERMISSIONS.MOVEMENTS_EDIT)) {
    return NextResponse.json({ message: "No puedes editar movimientos." }, { status: 403 });
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
  if (session.authorization.scope.mode === "COMPANY_LOCALITY" && assignedLocalidadId && movementLocalidadId !== assignedLocalidadId) {
    return NextResponse.json({ message: "Solo puedes ver mediciones de tu localidad." }, { status: 403 });
  }

  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
