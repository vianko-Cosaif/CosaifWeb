import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { canViewTorreonArrastreRole, normalizeRoleName } from "@/lib/torreonLocalidad";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

async function readSessionScope() {
  const cookieStore = await cookies();
  return {
    role: normalizeRoleName(cookieStore.get(process.env.ROLE_COOKIE_NAME || "role")?.value),
    localidadId: Number(cookieStore.get("locId")?.value || cookieStore.get("localidadId")?.value || 0),
  };
}

function validLocalidad(value: unknown) {
  const localidadId = Number(value);
  return Number.isInteger(localidadId) && localidadId > 0 && isTorreonLocalidad(localidadId)
    ? localidadId
    : null;
}

export async function GET(req: NextRequest) {
  const session = await readSessionScope();
  if (!canViewTorreonArrastreRole(session.role)) return jsonError("No autorizado para consultar vías de arrastre.", 403);

  const localidadId = validLocalidad(req.nextUrl.searchParams.get("localidadId"));
  if (!localidadId) return jsonError("Localidad de Torreón inválida.", 400);
  if (session.role !== "ADMINISTRADOR" && session.localidadId !== localidadId) {
    return jsonError("Solo puedes consultar el patio de arrastre de tu localidad.", 403);
  }

  try {
    const data = await fetchTorreonMsJson(`/catalogos/arrastre?localidadId=${localidadId}`);
    return NextResponse.json(data, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo cargar el patio de arrastre.", 502);
  }
}

export async function POST(req: NextRequest) {
  const session = await readSessionScope();
  if (session.role !== "ADMINISTRADOR") return jsonError("Solo un administrador puede configurar vías de arrastre.", 403);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const localidadId = validLocalidad(body?.localidadId);
  if (!body || !localidadId) return jsonError("Localidad de Torreón inválida.", 400);

  try {
    const data = await fetchTorreonMsJson("/catalogos/arrastre", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, localidadId }),
    });
    return NextResponse.json(data, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar el patio de arrastre.", 400);
  }
}
