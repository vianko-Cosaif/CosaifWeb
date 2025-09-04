import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const API = process.env.API_URL!;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      console.log("[RondaInfo] sin id");
      return NextResponse.json({}, { status: 200 });
    }

    const name = process.env.JWT_COOKIE_NAME || "token";
    const token = (await cookies()).get(name)?.value;

    const url = `${API}/movimientos/ronda/${id}/info`;
    const ua = req.headers.get("user-agent") || "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "n/a";

    console.log("[RondaInfo] →", {
      id,
      url,
      hasToken: Boolean(token),
      ua,
      ip,
    });

    const r = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    const raw = await r.clone().text();
    console.log("[RondaInfo] backend", {
      status: r.status,
      statusText: r.statusText,
      bodyPreview: raw.slice(0, 400),
    });

    if (!r.ok) return NextResponse.json({}, { status: 200 });

    let data: unknown = {};
    try { data = JSON.parse(raw); } catch {}
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[RondaInfo] error:", errorMessage);
    return NextResponse.json({}, { status: 200 });
  }
}
