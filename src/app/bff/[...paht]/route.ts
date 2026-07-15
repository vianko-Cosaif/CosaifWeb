import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);

function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

function buildUpstreamHeaders(req: NextRequest, token: string) {
  const headers = new Headers();
  const accept = req.headers.get("accept");
  const contentType = req.headers.get("content-type");
  const userAgent = req.headers.get("user-agent");
  const forwardedFor = req.headers.get("x-forwarded-for");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const incomingAuthorization = req.headers.get("authorization") || "";

  if (accept) headers.set("accept", accept);
  if (contentType) headers.set("content-type", contentType);
  if (userAgent) headers.set("user-agent", userAgent);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  } else if (incomingAuthorization) {
    headers.set("authorization", incomingAuthorization);
  }

  return headers;
}

function readUsersCollection(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["data", "usuarios", "items", "results"]) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object"
      );
    }
  }
  return [];
}

function userLocalidadId(user: Record<string, unknown>): number {
  const localidad = user.localidad && typeof user.localidad === "object"
    ? (user.localidad as Record<string, unknown>)
    : undefined;
  return Number(user.localidadId ?? localidad?.id ?? 0);
}

function filterUsersPayload(value: unknown, localidadId: number): unknown {
  const filter = (users: Record<string, unknown>[]) =>
    users.filter(
      (user) => userLocalidadId(user) === localidadId && String(user.rol || "").toUpperCase() !== "ADMINISTRADOR"
    );

  if (Array.isArray(value)) return filter(readUsersCollection(value));
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["data", "usuarios", "items", "results"]) {
    if (Array.isArray(record[key])) return { ...record, [key]: filter(readUsersCollection({ [key]: record[key] })) };
  }
  return value;
}

async function coordinatorCanManageUser(headers: Headers, userId: number, localidadId: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);
  try {
    const url = upstreamUrl("/usuarios", `?localidadId=${localidadId}`);
    const response = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    if (!response.ok) return false;
    const value = await response.json().catch(() => null);
    const user = readUsersCollection(value).find((item) => Number(item.id) === userId);
    return !!user && userLocalidadId(user) === localidadId && String(user.rol || "").toUpperCase() !== "ADMINISTRADOR";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function proxy(req: NextRequest) {
  if (!ORIGIN) {
    return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME ?? "token";
  const token =
    cookieStore.get(cookieName)?.value ||
    cookieStore.get("token")?.value ||
    "";
  const role = String(cookieStore.get(process.env.ROLE_COOKIE_NAME ?? "role")?.value || "").toUpperCase();
  const assignedLocalidadId = Number(
    cookieStore.get("locId")?.value || cookieStore.get("localidadId")?.value || 0
  );
  const restrictedLocality = role !== "ADMINISTRADOR";
  const restrictedCoordinator = role === "COORDINADOR";
  let upstreamPath = req.nextUrl.pathname.replace(/^\/bff/, "");
  const searchParams = new URLSearchParams(req.nextUrl.searchParams);
  const isCompanyWrite =
    (upstreamPath === "/empresas" || upstreamPath.startsWith("/empresas/")) &&
    !["GET", "HEAD"].includes(req.method);
  const isMovementPath = upstreamPath === "/movimientos" || upstreamPath.startsWith("/movimientos/");
  const isMovementListing = upstreamPath.includes("/pendientes") || upstreamPath === "/movimientos/buscar";
  const isUsersCollection = upstreamPath === "/usuarios";
  const isUsersPath = isUsersCollection || upstreamPath.startsWith("/usuarios/");
  const userTarget = upstreamPath.match(/^\/usuarios\/(\d+)(?:\/estado)?$/);

  if (isCompanyWrite && role !== "ADMINISTRADOR") {
    return NextResponse.json(
      { message: "Solo un administrador puede gestionar empresas." },
      { status: 403 }
    );
  }

  if (restrictedLocality && isMovementPath) {
    if (!Number.isFinite(assignedLocalidadId) || assignedLocalidadId <= 0) {
      return NextResponse.json({ message: "No hay una localidad asignada a la sesion." }, { status: 403 });
    }

    const requestedLocalidadId = Number(searchParams.get("localidadId") || 0);
    if (requestedLocalidadId > 0 && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu localidad." }, { status: 403 });
    }

    const embeddedLocalidad = upstreamPath.match(/\/localidad\/(\d+)(?:\/|$)/);
    if (embeddedLocalidad && Number(embeddedLocalidad[1]) !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu localidad." }, { status: 403 });
    }

    if (upstreamPath === "/movimientos/pendientes") {
      upstreamPath = `/movimientos/localidad/${assignedLocalidadId}/pendientes`;
    } else {
      const empresaPendientes = upstreamPath.match(/^\/movimientos\/empresa\/(\d+)\/pendientes$/);
      if (empresaPendientes) {
        upstreamPath = `/movimientos/empresa/${empresaPendientes[1]}/localidad/${assignedLocalidadId}/pendientes`;
      }
    }

    if (isMovementListing) searchParams.set("localidadId", String(assignedLocalidadId));
  }

  if (restrictedCoordinator && isUsersPath) {
    if (!Number.isFinite(assignedLocalidadId) || assignedLocalidadId <= 0) {
      return NextResponse.json({ message: "No hay una localidad asignada a la sesion." }, { status: 403 });
    }

    const requestedLocalidadId = Number(searchParams.get("localidadId") || 0);
    if (requestedLocalidadId > 0 && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes gestionar usuarios de tu localidad." }, { status: 403 });
    }

    if (isUsersCollection && req.method === "GET") {
      searchParams.set("localidadId", String(assignedLocalidadId));
    }
  }

  const search = searchParams.toString();
  const url = upstreamUrl(upstreamPath, search ? `?${search}` : "");
  const headers = buildUpstreamHeaders(req, token);

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    if (restrictedCoordinator && isUsersPath && userTarget) {
      const canManageTarget = await coordinatorCanManageUser(headers, Number(userTarget[1]), assignedLocalidadId).catch(
        () => false
      );
      if (!canManageTarget) {
        return NextResponse.json({ message: "Solo puedes gestionar usuarios de tu localidad." }, { status: 403 });
      }
    }

    if (restrictedCoordinator && isUsersPath && ["POST", "PUT", "PATCH"].includes(req.method)) {
      const payload = await req.json().catch(() => null);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
      }
      if (String((payload as Record<string, unknown>).rol || "").toUpperCase() === "ADMINISTRADOR") {
        return NextResponse.json({ message: "Solo un administrador puede gestionar administradores." }, { status: 403 });
      }
      body = JSON.stringify(
        upstreamPath.endsWith("/estado") ? payload : { ...payload, localidadId: assignedLocalidadId }
      );
      headers.set("content-type", "application/json");
    } else if (restrictedLocality && upstreamPath === "/movimientos" && req.method === "POST") {
      const payload = await req.json().catch(() => null);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
      }
      body = JSON.stringify({ ...payload, localidadId: assignedLocalidadId });
      headers.set("content-type", "application/json");
    } else {
      body = await req.arrayBuffer();
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);

  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    const responseBody = await r.arrayBuffer();
    const contentType = r.headers.get("content-type") ?? "application/json";

    if (restrictedCoordinator && isUsersCollection && req.method === "GET" && r.ok && contentType.includes("application/json")) {
      const parsed = JSON.parse(new TextDecoder().decode(responseBody)) as unknown;
      return NextResponse.json(filterUsersPayload(parsed, assignedLocalidadId), {
        status: r.status,
        headers: { "cache-control": "no-store" },
      });
    }

    return new NextResponse(responseBody, {
      status: r.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    console.error("[/bff/*] fetch error:", error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// Handlers HTTP
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
