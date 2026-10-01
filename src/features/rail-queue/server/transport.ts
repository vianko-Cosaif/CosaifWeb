import "server-only";
import { fetchUpstream, getErrorStatus } from "@/lib/server/upstream";
import { NextRequest } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { asRecord, readDetailRecord } from "./mapping";
import type { RondaInfoRecord, MovimientoDetailRecord, MovimientoRecord } from "./models";
import { RondasReadError } from "./errors";

export function getApiBase(origin: string) {
  const raw = String(process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!raw) return `${origin}/bff`.replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${origin}${raw}`.replace(/\/+$/, "");
  return normalizeHttpOrigin(raw).replace(/\/+$/, "");
}

function upstreamReadStatus(status: number): RondasReadError["status"] {
  if (status === 401 || status === 403) return status;
  return status === 408 || status === 504 ? 504 : 502;
}

export async function readRondasJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new RondasReadError(upstreamReadStatus(response.status));
  try {
    const data: unknown = await response.json();
    if (asRecord(data).success === false) throw new RondasReadError(502);
    return data;
  } catch (error) {
    if (getErrorStatus(error) === 504) throw error;
    throw new RondasReadError(502);
  }
}

export async function fetchRondasJsonFirst(
  urls: string[],
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<unknown> {
  for (const url of urls) {
    const response = await fetchUpstream(
      url,
      { method: "GET", headers, cache: "no-store" },
      signal,
    );
    if (response.status === 404 || response.status === 405) {
      await response.body?.cancel();
      continue;
    }
    return readRondasJson(response);
  }
  throw new RondasReadError(502);
}

export async function readTextAsJsonSafe(r: Response): Promise<unknown> {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t ? { message: t } : {};
  }
}

export function authHeaders(req: NextRequest, token?: string) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    "user-agent": req.headers.get("user-agent") || "",
    "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
  };
}

export async function fetchRondaInfo(
  base: string,
  headers: HeadersInit,
  rondaId: number,
  signal?: AbortSignal,
) {
  const raw = await fetchRondasJsonFirst(
    [
      `${base}/movimientos/ronda/${encodeURIComponent(String(rondaId))}/info`,
      `${base}/rondas/${encodeURIComponent(String(rondaId))}/info`,
    ],
    headers,
    signal,
  );
  return readDetailRecord(raw) as RondaInfoRecord;
}

export async function fetchMovimientoDetail(
  base: string,
  headers: HeadersInit,
  movimientoId: number,
  signal?: AbortSignal,
) {
  const raw = await fetchRondasJsonFirst(
    [
      `${base}/movimientos/${encodeURIComponent(String(movimientoId))}/edicion`,
      `${base}/movimientos/${encodeURIComponent(String(movimientoId))}`,
    ],
    headers,
    signal,
  );
  const data = readDetailRecord(raw) as MovimientoDetailRecord;
  return (data?.movimiento ?? data) as MovimientoRecord;
}
