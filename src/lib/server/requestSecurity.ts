import "server-only";
import { NextRequest, NextResponse } from "next/server";

type RateEntry = { count: number; resetAt: number };
const rateEntries = new Map<string, RateEntry>();
const MAX_TRACKED_CLIENTS = 5_000;

function requestOrigins(req: NextRequest) {
  const origins = new Set<string>();
  try { origins.add(new URL(req.url).origin); } catch {}
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
    try { origins.add(new URL(`${proto}://${forwardedHost.split(",")[0].trim()}`).origin); } catch {}
  }
  return origins;
}

/** Bloquea mutaciones iniciadas desde otro sitio (CSRF) sin romper clientes same-origin. */
export function rejectCrossSiteMutation(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null;

  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Solicitud de otro sitio rechazada" }, { status: 403 });
  }

  const origin = req.headers.get("origin");
  if (origin) {
    let normalized = "";
    try { normalized = new URL(origin).origin; } catch {}
    if (!normalized || !requestOrigins(req).has(normalized)) {
      return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
    }
  }
  return null;
}

export function rejectOversizedBody(req: NextRequest, maxBytes = 32_768) {
  const raw = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(raw) && raw > maxBytes) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }
  return null;
}

export function clientAddress(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** Límite local por instancia; el proxy/API debe mantener un segundo límite distribuido. */
export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const previous = rateEntries.get(key);
  const entry = !previous || previous.resetAt <= now
    ? { count: 1, resetAt: now + windowMs }
    : { count: previous.count + 1, resetAt: previous.resetAt };
  rateEntries.set(key, entry);

  if (rateEntries.size > MAX_TRACKED_CLIENTS) {
    for (const [candidate, value] of rateEntries) {
      if (value.resetAt <= now) rateEntries.delete(candidate);
      if (rateEntries.size <= MAX_TRACKED_CLIENTS) break;
    }
  }

  if (entry.count <= limit) return null;
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
  return NextResponse.json(
    { error: "Demasiados intentos. Espera un momento." },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

