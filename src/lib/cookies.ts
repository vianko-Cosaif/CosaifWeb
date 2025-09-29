// src/lib/cookies.ts
// Utilidades isomórficas (cliente/servidor) para manejar cookies en App Router (Next.js 13+)

export type SameSite = "lax" | "strict" | "none";
export type Role = "ADMINISTRADOR" | "COORDINADOR" | "CLIENTE";

export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;      // segundos
  sameSite?: SameSite;  // default: "lax"
  secure?: boolean;     // default: true en server, según protocolo en client
  expires?: Date;       // fecha absoluta
  httpOnly?: boolean;   // solo server
}

/* ============================
 * CLIENTE (browser)
 * ============================ */
export function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapeRegex(name)}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Alias cómodo para componentes cliente. */
export function getCookie(name: string): string | null {
  return getClientCookie(name);
}

export function setClientCookie(name: string, value: string, opts: CookieOptions = {}): void {
  if (typeof document === "undefined") return;
  const {
    path = "/",
    domain,
    maxAge,
    sameSite = "lax",
    secure = isHttps(),
    expires,
  } = opts;

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    path ? `path=${path}` : "",
    domain ? `domain=${domain}` : "",
    typeof maxAge === "number" ? `max-age=${Math.max(0, Math.floor(maxAge))}` : "",
    expires instanceof Date ? `expires=${expires.toUTCString()}` : "",
    sameSite ? `samesite=${sameSite}` : "",
    secure ? "secure" : "",
  ].filter(Boolean);

  document.cookie = parts.join("; ");
}

export function deleteClientCookie(
  name: string,
  opts: Omit<CookieOptions, "maxAge" | "expires" | "httpOnly"> = {}
): void {
  setClientCookie(name, "", { ...opts, maxAge: 0, expires: new Date(0) });
}

/** Parse plano de `document.cookie` → objeto { clave: valor }. */
export function parseDocumentCookie(): Record<string, string> {
  if (typeof document === "undefined") return {};
  return parseCookieHeader(document.cookie);
}

/* ============================
 * SERVIDOR (RSC/acciones/route handlers)
 * Nota: ¡siempre await! p.ej. `const v = await getServerCookie('x')`
 * ============================ */
export async function getServerCookie(name: string): Promise<string | null> {
  if (typeof window !== "undefined") return null;
  const { cookies } = await import("next/headers");
  const c = await cookies();
  return c.get(name)?.value ?? null;
}

export async function setServerCookie(name: string, value: string, opts: CookieOptions = {}): Promise<void> {
  if (typeof window !== "undefined") return;
  const { cookies } = await import("next/headers");
  const bag = await cookies();
  bag.set({
    name,
    value,
    path: opts.path ?? "/",
    domain: opts.domain,
    maxAge: opts.maxAge,
    sameSite: opts.sameSite ?? "lax",
    secure: opts.secure ?? true,
    expires: opts.expires,
    httpOnly: opts.httpOnly ?? false,
  });
}

export async function deleteServerCookie(
  name: string,
  opts: Omit<CookieOptions, "maxAge" | "expires"> = {}
): Promise<void> {
  if (typeof window !== "undefined") return;
  const { cookies } = await import("next/headers");
  const bag = await cookies();
  bag.set({
    name,
    value: "",
    path: opts.path ?? "/",
    domain: opts.domain,
    sameSite: opts.sameSite ?? "lax",
    secure: opts.secure ?? true,
    httpOnly: opts.httpOnly ?? false,
    maxAge: 0,
    expires: new Date(0),
  });
}

/* ============================
 * Conveniences para tu app
 * ============================ */
export function getLocIdClient(): number | null {
  const v = getClientCookie("locId");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export async function getLocIdServer(): Promise<number | null> {
  const v = await getServerCookie("locId");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function setLocIdClient(id: number): void {
  if (!Number.isFinite(id) || id <= 0) return;
  setClientCookie("locId", String(id), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export function getRoleClient(): Role | null {
  const v = (getClientCookie("role") ?? "").toUpperCase();
  return v === "ADMINISTRADOR" || v === "COORDINADOR" || v === "CLIENTE" ? (v as Role) : null;
}
export async function getRoleServer(): Promise<Role | null> {
  const v = ((await getServerCookie("role")) ?? "").toUpperCase();
  return v === "ADMINISTRADOR" || v === "COORDINADOR" || v === "CLIENTE" ? (v as Role) : null;
}


export function getEmpresaIdClient(): number | null {
  const v = getClientCookie("empresaId") ?? localStorage.getItem("empresaId");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export async function getEmpresaIdServer(): Promise<number | null> {
  const v = await getServerCookie("empresaId");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function setEmpresaIdClient(id: number): void {
  if (!Number.isFinite(id) || id <= 0) return;
  setClientCookie("empresaId", String(id), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

/* ============================
 * Utilidades internas
 * ============================ */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(";").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1);
    if (!k) continue;
    out[k] = safeDecode(v);
  }
  return out;
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isHttps(): boolean {
  try {
    return typeof location !== "undefined" ? location.protocol === "https:" : true;
  } catch {
    return true;
  }
}
