import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { parseAuthorizationProfile } from "@/lib/accessControl";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/sessionToken";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const JWT_COOKIE = process.env.JWT_COOKIE_NAME || "token";
const MAX_AGE = Number(process.env.COOKIE_MAX_AGE || 60 * 60 * 8);
const TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12_000);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const positiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function safeLocalSession(session: NonNullable<Awaited<ReturnType<typeof verifySessionToken>>>) {
  return {
    user: {
      id: session.userId,
      rol: session.role,
      empresaId: session.empresaId,
      localidadId: session.localidadId,
      authorization: session.authorization,
    },
    authorization: session.authorization,
  };
}

function noStore<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const signedSession = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  const upstreamToken = req.cookies.get(JWT_COOKIE)?.value;
  if (!signedSession || !upstreamToken) return noStore({ error: "No autenticado" }, { status: 401 });

  // Una caída temporal del backend no destruye una sesión local todavía válida.
  if (!ORIGIN) return noStore({ ...safeLocalSession(signedSession), degraded: true });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(`${ORIGIN}/usuarios/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${upstreamToken}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (upstream.status === 401 || upstream.status === 403) {
      return noStore({ error: "La sesión ya no es válida" }, { status: upstream.status });
    }
    if (!upstream.ok) return noStore({ ...safeLocalSession(signedSession), degraded: true });

    const payload = await upstream.json().catch(() => null);
    if (!isRecord(payload)) return noStore({ ...safeLocalSession(signedSession), degraded: true });
    const user = isRecord(payload.user) ? payload.user : null;
    const authorization = parseAuthorizationProfile(payload.authorization ?? user?.authorization);
    const userId = positiveInteger(user?.id);
    if (
      !user || !authorization || !authorization.platforms.web || !authorization.capabilities.canUseWeb ||
      !userId || userId !== signedSession.userId
    ) {
      return noStore({ error: "El perfil autorizado cambió" }, { status: 403 });
    }

    const expiresAt = isRecord(payload.session) && typeof payload.session.expiresAt === "string"
      ? Date.parse(payload.session.expiresAt)
      : Number.NaN;
    const remainingSeconds = Number.isFinite(expiresAt) ? Math.floor((expiresAt - Date.now()) / 1_000) : MAX_AGE;
    const maxAge = Math.min(MAX_AGE, remainingSeconds);
    if (maxAge < 60) return noStore({ error: "La sesión expiró" }, { status: 401 });

    const empresaId = authorization.scope.empresaId;
    const localidadId = authorization.scope.localidadId;
    const refreshed = await createSessionToken({ role: authorization.role, userId, empresaId, localidadId, authorization }, maxAge);
    const response = noStore({
      user: {
        id: userId,
        nombre: typeof user.nombre === "string" ? user.nombre.slice(0, 160) : "",
        rol: authorization.role,
        empresaId,
        localidadId,
        empresa: isRecord(user.empresa) ? user.empresa : null,
        localidad: isRecord(user.localidad) ? user.localidad : null,
        authorization,
      },
      authorization,
      degraded: false,
    });
    response.cookies.set(SESSION_COOKIE_NAME, refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge,
    });
    return response;
  } catch {
    return noStore({ ...safeLocalSession(signedSession), degraded: true });
  } finally {
    clearTimeout(timeoutId);
  }
}
