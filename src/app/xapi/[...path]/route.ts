/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/xapi/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL!;                         // ej: http://192.168.100.30:8080
const TOKEN_COOKIE = process.env.JWT_COOKIE_NAME ?? "token";

export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;                         // params async
  const jar = await cookies();                               // cookies async
  const token = jar.get(TOKEN_COOKIE)?.value || "";

  const orig = new URL(req.url);
  const destURL = `${API_URL}/${path.join("/")}${orig.search}`;

  const h = new Headers(req.headers);
  h.set("host", new URL(API_URL).host);
  h.delete("connection");
  if (token) h.set("authorization", `Bearer ${token}`);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const upstream = await fetch(destURL, {
    method: req.method,
    headers: h,
     
    body: hasBody ? (req as any).body : undefined,
    duplex: hasBody ? "half" : undefined,
    cache: "no-store",
  } as any);

  const rh = new Headers(upstream.headers);
  rh.delete("content-encoding");
  rh.delete("transfer-encoding");

  return new NextResponse(upstream.body, { status: upstream.status, headers: rh });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
