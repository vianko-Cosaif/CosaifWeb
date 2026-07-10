import "server-only";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

const DEFAULT_TORREON_MS_URL = "http://127.0.0.1:3003/api";
const DEFAULT_TORREON_LOCALIDAD_ID = "2";
const DEFAULT_SERVICE_ID = "cosaif-web";
const EMPTY_BODY_HASH = crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const LOCAL_TORREON_ENV_CANDIDATES = [
  process.env.TORREON_ENV_PATH,
  path.resolve(process.cwd(), "../BackCosaif2/ms_torreon/.env.torreon"),
  path.resolve(process.cwd(), "../BackCosaif2/ms_torreon/.env"),
].filter((item): item is string => Boolean(item));

let localTorreonEnv: Map<string, string> | null = null;

type ServiceCredentials = {
  serviceId: string;
  secret: string;
};

function cleanBaseUrl(value?: string) {
  return (value || DEFAULT_TORREON_MS_URL).replace(/\/+$/, "");
}

function cleanOptionalBaseUrl(value?: string) {
  const cleaned = String(value || "").trim().replace(/\/+$/, "");
  return cleaned || "";
}

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadLocalTorreonEnv() {
  if (localTorreonEnv) return localTorreonEnv;

  localTorreonEnv = new Map<string, string>();
  if (process.env.NODE_ENV === "production") return localTorreonEnv;

  for (const candidate of LOCAL_TORREON_ENV_CANDIDATES) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const content = fs.readFileSync(candidate, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const index = line.indexOf("=");
        if (index <= 0) continue;
        const key = line.slice(0, index).trim();
        const value = parseEnvValue(line.slice(index + 1));
        if (key) localTorreonEnv.set(key, value);
      }
      break;
    } catch {
      localTorreonEnv.clear();
    }
  }

  return localTorreonEnv;
}

function readEnv(name: string) {
  return process.env[name]?.trim() || loadLocalTorreonEnv().get(name)?.trim() || "";
}

function parseSecretMap() {
  const raw = readEnv("TORREON_SERVICE_AUTH_SECRETS");
  if (!raw) return new Map<string, string>();

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(
      Object.entries(parsed).filter((entry): entry is [string, string] => {
        const [serviceId, secret] = entry;
        return Boolean(serviceId?.trim() && secret?.trim());
      })
    );
  } catch {
    return new Map<string, string>();
  }
}

function resolveServiceCredentials(): ServiceCredentials {
  const secrets = parseSecretMap();
  const entries = Array.from(secrets.entries());
  const envServiceId = readEnv("TORREON_SERVICE_ID");
  const serviceId = envServiceId || (entries.length === 1 ? entries[0][0] : DEFAULT_SERVICE_ID);
  const secret = readEnv("TORREON_SERVICE_SECRET") || secrets.get(serviceId)?.trim() || "";

  if (!serviceId || !secret) {
    throw new Error(
      "Falta configurar TORREON_SERVICE_AUTH_SECRETS o TORREON_SERVICE_ID/TORREON_SERVICE_SECRET"
    );
  }

  return { serviceId, secret };
}

function bodyToBuffer(body?: BodyInit) {
  if (!body) return Buffer.alloc(0);
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());

  const rawBody = body as unknown;
  if (rawBody instanceof ArrayBuffer) return Buffer.from(rawBody);
  if (ArrayBuffer.isView(rawBody)) {
    return Buffer.from(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength);
  }

  throw new Error("El cliente de ms_torreon solo soporta bodies string, URLSearchParams o ArrayBuffer");
}

async function readRequestToken() {
  try {
    const store = await cookies();
    return store.get(process.env.JWT_COOKIE_NAME || "token")?.value || store.get("token")?.value || "";
  } catch {
    return "";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
    throw new Error(String(record.error || record.message || `ms_torreon respondio ${response.status}`));
  }

  return data as T;
}

async function fetchTorreonViaBackProxy<T>(pathWithQuery: string, init: RequestInit, body?: BodyInit) {
  const method = String(init.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const token = await readRequestToken();
  const apiOrigin = cleanOptionalBaseUrl(process.env.API_ORIGIN);
  if (!token || !apiOrigin) return undefined;

  const url = new URL(`${apiOrigin}/torreon/${pathWithQuery.replace(/^\/+/, "")}`);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    method,
    headers,
    body,
    cache: "no-store",
  });

  return parseJsonResponse<T>(response);
}

function sha256Hex(body: Buffer) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

function buildSignaturePayload(params: {
  method: string;
  pathWithQuery: string;
  timestamp: string;
  nonce: string;
  bodyHash?: string;
}) {
  return [
    params.method.toUpperCase(),
    params.pathWithQuery,
    params.timestamp,
    params.nonce,
    params.bodyHash ?? EMPTY_BODY_HASH,
  ].join("\n");
}

function signRequest(params: {
  method: string;
  pathWithQuery: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
  secret: string;
}) {
  const payload = buildSignaturePayload(params);
  return `v1=${crypto.createHmac("sha256", params.secret).update(payload).digest("hex")}`;
}

export function isTorreonLocalidad(localidadId?: string | number) {
  const target = Number(localidadId);
  if (!Number.isFinite(target) || target <= 0) return false;

  const configured = process.env.TORREON_LOCALIDAD_IDS || process.env.TORREON_LOCALIDAD_ID || DEFAULT_TORREON_LOCALIDAD_ID;
  return configured
    .split(",")
    .map((item) => Number(item.trim()))
    .some((item) => Number.isFinite(item) && item === target);
}

export async function fetchTorreonMsJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = String(init.method || "GET").toUpperCase();
  const body = init.body ?? undefined;

  const proxied = await fetchTorreonViaBackProxy<T>(path, init, body);
  if (proxied !== undefined) return proxied;

  const base = cleanBaseUrl(readEnv("TORREON_MS_URL") || process.env.NEXT_PRIVATE_TORREON_MS_URL);
  const url = new URL(`${base}/${path.replace(/^\/+/, "")}`);
  const pathWithQuery = `${url.pathname}${url.search}`;
  const bodyHash = sha256Hex(bodyToBuffer(body));
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const { serviceId, secret } = resolveServiceCredentials();
  const signature = signRequest({ method, pathWithQuery, timestamp, nonce, bodyHash, secret });
  const headers = new Headers(init.headers);

  headers.set("x-service-id", serviceId);
  headers.set("x-timestamp", timestamp);
  headers.set("x-nonce", nonce);
  headers.set("x-content-sha256", bodyHash);
  headers.set("x-signature", signature);

  const response = await fetch(url, {
    ...init,
    method,
    headers,
    cache: "no-store",
  });

  return parseJsonResponse<T>(response);
}
