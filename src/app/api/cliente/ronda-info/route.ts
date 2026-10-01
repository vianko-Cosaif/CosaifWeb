import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";
import { MovementScopeError, recordMatchesMovementScope, resolveMovementReadScope } from "@/lib/auth/movementScope";
import { fetchUpstream, getErrorStatus } from "@/lib/server/upstream";
import { mapConcurrent } from "@/lib/http/concurrency";

export const dynamic = "force-dynamic";
const JWT = process.env.JWT_COOKIE_NAME ?? "token";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(req: Request) {
  const controller = new AbortController();
  const signal = AbortSignal.any([req.signal, controller.signal]);
  try {
    const { searchParams } = new URL(req.url);
    const cookieStore = await cookies();
    const token = cookieStore.get(JWT)?.value;
    const session = await getVerifiedSession();
    if (!token || !session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (!hasPermission(session.authorization, PERMISSIONS.ROUNDS_READ)) {
      return NextResponse.json({ message: "No autorizado para consultar rondas" }, { status: 403 });
    }
    // A shared current queue never grants access to another company's details.
    const scope = resolveMovementReadScope(session, "detail", searchParams);
    const rawIds = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (rawIds.some((id) => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
      return NextResponse.json({ message: "Identificadores de ronda inválidos" }, { status: 400 });
    }
    const ids = Array.from(new Set(rawIds));
    if (ids.length > 50) return NextResponse.json({ message: "Consulta como máximo 50 rondas" }, { status: 400 });
    if (ids.length === 0) return NextResponse.json({});
    const origin = normalizeHttpOrigin(process.env.API_ORIGIN || process.env.API_URL);
    if (!origin) return NextResponse.json({ message: "API no configurada" }, { status: 503 });

    const results = await mapConcurrent(ids, 4, async (id) => {
      const params = new URLSearchParams();
      if (scope.empresaId) params.set("empresaId", String(scope.empresaId));
      if (scope.localidadId) params.set("localidadId", String(scope.localidadId));
      const response = await fetchUpstream(`${origin}/movimientos/ronda/${encodeURIComponent(id)}/info?${params}`, {
        headers: { authorization: `Bearer ${token}` },
      }, signal);
      if (response.status === 404) return null;
      if (response.status === 401 || response.status === 403) throw new MovementScopeError("No autorizado para consultar estas rondas.");
      if (!response.ok) throw new Error("Servicio de rondas no disponible");
      const data: unknown = await response.json();
      const detail = asRecord(data);
      const movement = asRecord(detail.movimiento);
      const company = asRecord(detail.empresa ?? movement.empresa);
      const locality = asRecord(movement.localidad ?? detail.localidad);
      if (!recordMatchesMovementScope({
        empresaId: detail.empresaId ?? company.id ?? movement.empresaId,
        localidadId: detail.localidadId ?? movement.localidadId ?? locality.id,
      }, scope)) {
        throw new MovementScopeError("Solo puedes consultar detalles de tu empresa y localidad asignadas.");
      }
      return [id, data] as const;
    });
    return NextResponse.json(Object.fromEntries(results.filter((row) => row !== null)));
  } catch (error) {
    if (error instanceof MovementScopeError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "No se pudieron consultar los detalles de las rondas" }, { status: getErrorStatus(error) });
  } finally {
    controller.abort();
  }
}
