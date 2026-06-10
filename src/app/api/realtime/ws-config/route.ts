import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiOriginToWebSocketUrl, normalizeHttpOrigin } from "@/lib/serverOrigin";

const API_ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN || process.env.API_BASE || process.env.API_URL || "");
const TOKEN_COOKIE = process.env.JWT_COOKIE_NAME || "token";

export const dynamic = "force-dynamic";

function toPositiveInt(value: string | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export async function GET(req: Request) {
  if (!API_ORIGIN) {
    return NextResponse.json({ ok: false, error: "API_ORIGIN not set" }, { status: 503 });
  }

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const currentUrl = new URL(req.url);
  const localidadId = toPositiveInt(currentUrl.searchParams.get("localidadId"));
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProto = forwardedProto || currentUrl.protocol.replace(":", "");
  const defaultWsUrl = apiOriginToWebSocketUrl(API_ORIGIN);
  const wouldBeMixedContent = requestProto === "https" && defaultWsUrl.protocol === "ws:";

  if (wouldBeMixedContent) {
    return NextResponse.json({
      ok: true,
      transport: "sse",
      url: null,
      reason: "WebSocket directo desactivado en PWA HTTPS; usar SSE mismo-origen.",
      expiresAt: null,
    });
  }

  const ticketUrl = new URL(`${API_ORIGIN}/realtime/ws-ticket`);
  if (localidadId) ticketUrl.searchParams.set("localidadId", String(localidadId));

  const ticketResponse = await fetch(ticketUrl.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!ticketResponse.ok) {
    return NextResponse.json(
      { ok: false, error: "No se pudo preparar realtime" },
      { status: ticketResponse.status === 401 ? 401 : 502 }
    );
  }

  const payload = (await ticketResponse.json()) as {
    realtime?: { ticket?: string; expiresAt?: string; path?: string };
  };
  const ticket = payload.realtime?.ticket;
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Ticket realtime invalido" }, { status: 502 });
  }

  const wsUrl = apiOriginToWebSocketUrl(API_ORIGIN, payload.realtime?.path || "/realtime/ws");
  wsUrl.searchParams.set("ticket", ticket);

  return NextResponse.json({
    ok: true,
    transport: "websocket",
    url: wsUrl.toString(),
    expiresAt: payload.realtime?.expiresAt ?? null,
  });
}
