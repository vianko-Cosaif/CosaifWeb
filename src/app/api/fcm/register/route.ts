import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { getNotificationRuntimePolicy } from "@/lib/notificationRuntime";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const FCM_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);
const JWT_COOKIE = process.env.JWT_COOKIE_NAME || "token";

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

function getForwardedOrigin(req: NextRequest) {
  const host =
    firstHeaderValue(req.headers.get("x-forwarded-host")) ??
    firstHeaderValue(req.headers.get("host"));
  const protocol =
    firstHeaderValue(req.headers.get("x-forwarded-proto")) ??
    req.nextUrl.protocol.replace(/:$/, "");

  if (!host || !["http", "https"].includes(protocol)) return undefined;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return undefined;
  }
}

function isAllowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      return false;
    }

    const allowedOrigins = new Set([req.nextUrl.origin, getForwardedOrigin(req)].filter(Boolean));
    if (!allowedOrigins.has(normalizedOrigin)) return false;
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  return true;
}

function toPositiveInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function readString(body: Record<string, unknown>, key: string) {
  return String(body[key] ?? "").trim();
}

function isLikelyFcmToken(token: string) {
  return token.length >= 80 && token.length <= 500 && /^[A-Za-z0-9_:\-.]+$/.test(token);
}
function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  if (!ORIGIN) {
    return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });
  }

  const policy = getNotificationRuntimePolicy();
  if (!policy.enabled) {
    return NextResponse.json(
      { error: "Notificaciones deshabilitadas para este ambiente", runtimeEnv: policy.runtimeEnv },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const token = readString(body, "token");
  const runtimeEnv = readString(body, "runtimeEnv");
  const appEnv = readString(body, "appEnv");
  const cookieStore = await cookies();
  const accessToken = readString(body, "accessToken") || cookieStore.get(JWT_COOKIE)?.value || "";
  const localidadId = toPositiveInt(body?.localidadId);

  if (!runtimeEnv || runtimeEnv !== policy.runtimeEnv || (appEnv && appEnv !== policy.appEnv)) {
    return NextResponse.json({ error: "Ambiente de notificaciones invalido" }, { status: 409 });
  }

  if (!isLikelyFcmToken(token)) {
    return NextResponse.json({ error: "Token FCM invalido" }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "token y accessToken son requeridos" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FCM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${ORIGIN}/fcm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        runtimeEnv: policy.runtimeEnv,
        appEnv: policy.appEnv,
        ...(localidadId ? { localidadId } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    console.error("[api/fcm/register] fetch error:", error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
