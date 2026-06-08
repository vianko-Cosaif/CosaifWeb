// app/api/passthrough/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";

const API_BASE = normalizeHttpOrigin(
  process.env.API_BASE ||
  process.env.API_URL ||
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
);
const JWT_NAME = process.env.JWT_COOKIE_NAME || "token";
type RouteCtx = { params: Promise<{ path: string[] }> };

function targetUrl(base: string, path: string[], search: string) {
  const cleanBase = base.trim();
  if (!cleanBase) throw new Error("Falta configurar API_ORIGIN, API_BASE o API_URL");
  const u = new URL(cleanBase);
  u.pathname = `${u.pathname.replace(/\/$/, "")}/${path.join("/")}`;
  u.search = search;
  return u.toString();
}

async function forward(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params; // <- clave
  let url: string;
  try {
    url = targetUrl(API_BASE, path, req.nextUrl.search);
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL de API invalida";
    return NextResponse.json({ message }, { status: 503 });
  }

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  // Levanta Bearer desde cookie si falta
  const token = req.cookies.get(JWT_NAME)?.value;
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);

  // Reenvía cookies del cliente al backend
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.from(await req.arrayBuffer());

  const upstream = await fetch(url, { method: req.method, headers, body, redirect: "manual", cache: "no-store" });

  const resp = new NextResponse(upstream.body, { status: upstream.status });
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== "content-encoding") resp.headers.set(k, v);
  });

  // Si el backend fija dominio en la cookie, quítalo para tu dominio actual
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) resp.headers.set("set-cookie", setCookie.replace(/; *Domain=[^;]+/gi, ""));

  return resp;
}

export const dynamic = "force-dynamic";

// Exporta todos los verbos usando el mismo forward
export async function GET(req: NextRequest, ctx: RouteCtx)  { return forward(req, ctx); }
export async function POST(req: NextRequest, ctx: RouteCtx) { return forward(req, ctx); }
export async function PUT(req: NextRequest, ctx: RouteCtx)  { return forward(req, ctx); }
export async function PATCH(req: NextRequest, ctx: RouteCtx){ return forward(req, ctx); }
export async function DELETE(req: NextRequest, ctx: RouteCtx){ return forward(req, ctx); }
export async function OPTIONS(req: NextRequest, ctx: RouteCtx){ return forward(req, ctx); }
export async function HEAD(req: NextRequest, ctx: RouteCtx) { return forward(req, ctx); }
