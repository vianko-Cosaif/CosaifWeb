// app/api/cliente/rondas/route.ts
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const localidadId = searchParams.get("localidadId");
    if (!localidadId) return NextResponse.json([], { status: 200 });

    const name = process.env.JWT_COOKIE_NAME || "token";
    const cookieStore = await cookies();
    const token = cookieStore.get(name)?.value;

    // Reenviar TODAS las cookies (lo que espera el BFF)
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");

    const targets = [`${origin}/bff/rondas/localidad/${localidadId}/estado/false`];

    for (const url of targets) {
      console.log("[cliente/rondas] →", {
        url,
        hasToken: Boolean(token),
        cookieLen: cookieHeader.length,
      });

      const r = await fetch(url, {
        method: "GET",
        // IMPORTANTE: reenviar cookies y, opcionalmente, Authorization
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "user-agent": req.headers.get("user-agent") || "",
          "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
        },
        cache: "no-store",
      });

      const body = await r.text();
      console.log("[cliente/rondas] backend:", r.status, r.statusText, "| body:", body.slice(0, 120));

      if (r.ok) {
        try {
          const data = JSON.parse(body);
          return NextResponse.json(data, { status: 200 });
        } catch {
          return NextResponse.json([], { status: 200 });
        }
      }
    }

    console.warn("[cliente/rondas] ningún path respondió OK");
    return NextResponse.json([], { status: 200 });
  } catch (err) {
    console.error("[cliente/rondas] error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
