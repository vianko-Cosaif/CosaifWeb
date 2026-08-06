import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRoleCapabilities, normalizeAppRole } from "@/lib/accessControl";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import {
  clientAddress,
  consumeRateLimit,
  rejectCrossSiteMutation,
  rejectOversizedBody,
} from "@/lib/server/requestSecurity";
import {
  createSessionToken,
  hasSecureSessionSecret,
  SESSION_COOKIE_NAME,
} from "@/lib/sessionToken";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12_000);
const MAX_AGE = Number(process.env.COOKIE_MAX_AGE || 60 * 60 * 8);
const JWT_COOKIE = process.env.JWT_COOKIE_NAME || "token";
const ROLE_COOKIE = process.env.ROLE_COOKIE_NAME || "role";

const LoginInput = z.object({
  nombre: z.string().trim().min(1).max(128),
  contrasena: z.string().min(1).max(256),
}).strict();

type LoginPayload = {
  token?: unknown;
  role?: unknown;
  id?: unknown;
  user?: {
    id?: unknown;
    rol?: unknown;
    empresaId?: unknown;
    empresa?: { id?: unknown };
    localidadId?: unknown;
  };
};

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function upstreamErrorStatus(error: unknown): 502 | 504 {
  return (error as { name?: string })?.name === "AbortError" ? 504 : 502;
}

export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const rejected = rejectCrossSiteMutation(req) || rejectOversizedBody(req, 8_192);
  if (rejected) return rejected;
  if (!ORIGIN) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });
  if (!hasSecureSessionSecret()) {
    return NextResponse.json(
      { error: "Falta configurar SESSION_SECRET con al menos 32 caracteres" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = LoginInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 400 });
  }

  const limited = consumeRateLimit(
    `login:${clientAddress(req)}:${parsed.data.nombre.toLocaleLowerCase("es-MX")}`,
    8,
    10 * 60_000,
  );
  if (limited) return limited;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${ORIGIN}/usuarios/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await upstream.text();

    if (!upstream.ok) {
      return new NextResponse(raw || JSON.stringify({ error: "Credenciales inválidas" }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    let payload: LoginPayload;
    try { payload = JSON.parse(raw) as LoginPayload; } catch {
      return NextResponse.json({ error: "Respuesta inválida del servicio" }, { status: 502 });
    }

    const token = typeof payload.token === "string" && payload.token.length <= 16_384 ? payload.token : "";
    const role = normalizeAppRole(String(payload.user?.rol || payload.role || ""));
    const userId = positiveInteger(payload.user?.id ?? payload.id);
    const empresaId = positiveInteger(payload.user?.empresaId ?? payload.user?.empresa?.id);
    const localidadId = positiveInteger(payload.user?.localidadId);
    if (!token || !role || !userId || !getRoleCapabilities(role).canUseWeb) {
      return NextResponse.json({ error: "Cuenta sin acceso web válido" }, { status: 403 });
    }

    const sessionToken = await createSessionToken({ role, userId, empresaId, localidadId }, MAX_AGE);
    const response = NextResponse.json(
      { ...payload, token: undefined },
      { headers: { "Cache-Control": "no-store" } },
    );
    const secure = process.env.NODE_ENV === "production";
    const protectedCookie = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
    const uiCookie = { secure, sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, protectedCookie);
    response.cookies.set(JWT_COOKIE, token, protectedCookie);
    response.cookies.set(ROLE_COOKIE, role, protectedCookie);
    response.cookies.set("userId", String(userId), uiCookie);
    if (empresaId) response.cookies.set("empresaId", String(empresaId), uiCookie);
    if (localidadId) response.cookies.set("locId", String(localidadId), uiCookie);
    return response;
  } catch (error) {
    const status = upstreamErrorStatus(error);
    return NextResponse.json(
      { error: status === 504 ? "El servicio tardó demasiado" : "Servicio no disponible" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
