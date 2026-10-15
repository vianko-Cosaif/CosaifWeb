import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { fetchUpstream } from "@/lib/server/upstream";
import { hasPermission, type Permission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";
import { isTorreonLocalidad, TorreonMsError } from "@/lib/torreonMs";

type Context = { params: Promise<{ id: string }> };
type RecordValue = Record<string, unknown>;

export function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
}

function unwrap(value: unknown): RecordValue {
  const root = record(value);
  return "data" in root ? record(root.data) : root;
}

type GatewaySession = { origin: string; token: string };

export async function gatewayMovement(
  id: number,
  gateway: GatewaySession,
  body?: RecordValue,
  action = "",
) {
  const response = await fetchUpstream(`${gateway.origin}/torreon/movimientos/${id}${action}`, {
    method: body ? "PATCH" : "GET",
    headers: {
      authorization: `Bearer ${gateway.token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = record(payload).message ?? record(payload).error;
    throw new TorreonMsError(
      response.status >= 500
        ? "No se pudo consultar el movimiento."
        : typeof message === "string"
          ? message.slice(0, 180)
          : "No se pudo consultar el movimiento.",
      response.status,
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TorreonMsError("Respuesta inválida del backend.", 502);
  }
  return unwrap(payload);
}

export async function scopedMovement(context: Context, permission: Permission) {
  const session = await getVerifiedSession();
  if (!session)
    return {
      error: NextResponse.json({ message: "Sesión expirada." }, { status: 401 }),
    };
  if (
    !["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(session.role) ||
    !hasPermission(session.authorization, permission)
  ) {
    return {
      error: NextResponse.json(
        { message: "No tienes permiso para modificar esta solicitud." },
        { status: 403 },
      ),
    };
  }
  if (!session.empresaId) {
    return {
      error: NextResponse.json({ message: "Se requiere una empresa asignada." }, { status: 403 }),
    };
  }
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return {
      error: NextResponse.json({ message: "Movimiento inválido." }, { status: 400 }),
    };
  }
  const cookieStore = await cookies();
  const token =
    cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value ||
    cookieStore.get("token")?.value;
  if (!token)
    return {
      error: NextResponse.json({ message: "Sesión expirada." }, { status: 401 }),
    };
  const origin = normalizeHttpOrigin(process.env.API_ORIGIN);
  if (!origin)
    return {
      error: NextResponse.json({ message: "API_ORIGIN no configurado." }, { status: 500 }),
    };
  const gateway = { origin, token };
  const movement = await gatewayMovement(id, gateway);
  if (
    Number(movement.empresaId) !== session.empresaId ||
    !isTorreonLocalidad(Number(movement.localidadId)) ||
    (session.authorization.scope.mode === "COMPANY_LOCALITY" &&
      Number(movement.localidadId) !== session.localidadId)
  ) {
    return {
      error: NextResponse.json(
        {
          message: "Sólo puedes modificar movimientos de tu empresa y localidad.",
        },
        { status: 403 },
      ),
    };
  }
  if (
    Number(movement.clienteId) !== session.userId &&
    Number(movement.creadoPorId) !== session.userId
  ) {
    return {
      error: NextResponse.json(
        { message: "Sólo puedes modificar las solicitudes que creaste o solicitaste." },
        { status: 403 },
      ),
    };
  }
  return { id, movement, gateway, session };
}

export function failure(error: unknown) {
  return NextResponse.json(
    {
      message: error instanceof Error ? error.message : "No se pudo consultar el movimiento.",
    },
    { status: error instanceof TorreonMsError ? error.status : 502 },
  );
}
