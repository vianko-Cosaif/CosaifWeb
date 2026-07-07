import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";

export const dynamic = "force-dynamic";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);
const ALLOWED_TORREON_ROLES = new Set([
  "ADMINISTRADOR",
  "COORDINADOR",
  "SUPERVISOR",
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
  "MAQUINISTA",
  "MAQUINISTA_ARRASTRE",
]);

type UnknownRecord = Record<string, unknown>;

function asRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
}

function asArray(input: unknown): UnknownRecord[] {
  const record = asRecord(input);
  if (Array.isArray(input)) return input as UnknownRecord[];
  if (Array.isArray(record.data)) return record.data as UnknownRecord[];
  return [];
}

function asNumber(input: unknown): number | null {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function cleanText(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

function readRole(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return String(cookieStore.get(process.env.ROLE_COOKIE_NAME || "role")?.value || "").toUpperCase();
}

function readEmpresaId(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    asNumber(cookieStore.get("empresaId")?.value) ||
    asNumber(cookieStore.get("empresald")?.value) ||
    asNumber(cookieStore.get("empresaID")?.value)
  );
}

function readLocalidadId(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    asNumber(cookieStore.get("locId")?.value) ||
    asNumber(cookieStore.get("localidadId")?.value)
  );
}

function readUserId(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    asNumber(cookieStore.get("userId")?.value) ||
    asNumber(cookieStore.get("uid")?.value) ||
    asNumber(cookieStore.get("usuarioId")?.value)
  );
}

function canSeeAllEmpresas(role: string) {
  return ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(role);
}

function requireTorreonSession(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value || cookieStore.get("token")?.value;
  const role = readRole(cookieStore);
  if (!token || !ALLOWED_TORREON_ROLES.has(role)) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 }) };
  }
  return { ok: true as const, role };
}

function assertTorreonAccess(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  incidente: ReturnType<typeof mapTorreonIncidente>
) {
  const role = readRole(cookieStore);
  if (canSeeAllEmpresas(role)) return true;

  const empresaId = readEmpresaId(cookieStore);
  const localidadId = readLocalidadId(cookieStore);
  const incidenteEmpresaId = asNumber(incidente.movimiento?.empresaId);
  const incidenteLocalidadId = asNumber(incidente.localidadId);

  if (empresaId && incidenteEmpresaId && empresaId !== incidenteEmpresaId) return false;
  if (localidadId && incidenteLocalidadId && localidadId !== incidenteLocalidadId) return false;
  return Boolean(empresaId || localidadId);
}

function formatTorreonRef(snapshot: unknown, fallbackPrefix: string, id: unknown) {
  const snapshotText = cleanText(snapshot);
  if (snapshotText) return snapshotText;
  const numericId = asNumber(id);
  return numericId ? `${fallbackPrefix} ${numericId}` : null;
}

function formatTorreonVia(movimiento: UnknownRecord, prefix: "Origen" | "Destino") {
  const key = prefix === "Origen" ? "Origen" : "Destino";
  const via = formatTorreonRef(movimiento[`via${key}NombreSnapshot`], "Via", movimiento[`via${key}Id`]);
  const seccion = formatTorreonRef(movimiento[`seccion${key}NombreSnapshot`], "Seccion", movimiento[`seccion${key}Id`]);
  if (via && seccion) return `${via} / ${seccion}`;
  return via || seccion || null;
}

function normalizeTorreonFotos(input: unknown) {
  return asArray(input)
    .map((foto) => {
      const url = toTorreonImageProxyUrl(foto.url);
      if (!url) return null;
      return {
        id: asNumber(foto.id),
        tipo: cleanText(foto.tipo),
        orden: asNumber(foto.orden) ?? 1,
        url,
        storageKey: cleanText(foto.storageKey),
        comentario: cleanText(foto.comentario),
        tomadaAt: cleanText(foto.tomadaAt),
      };
    })
    .filter((foto): foto is NonNullable<typeof foto> => Boolean(foto));
}

function mapTorreonIncidente(input: UnknownRecord) {
  const movimiento = asRecord(input.movimiento);
  const empresaId = asNumber(movimiento.empresaId);
  const fotos = normalizeTorreonFotos(input.fotos);
  const imagenes = fotos.map((foto) => foto.url);

  return {
    id: asNumber(input.id) ?? input.id,
    descripcion: cleanText(input.motivo) || "Incidente Torreon",
    motivo: cleanText(input.motivo),
    estado: cleanText(input.estado) || "ABIERTO",
    fechaInicio: cleanText(input.fechaInicio),
    fechaResolucion: cleanText(input.fechaResolucion),
    localidadId: asNumber(input.localidadId),
    viaBloqueadaId: asNumber(input.viaBloqueadaId),
    seccionBloqueadaId: asNumber(input.seccionBloqueadaId),
    imagenes,
    imagen1: imagenes[0],
    imagen2: imagenes[1],
    imagen3: imagenes[2],
    imagen4: imagenes[3],
    fotos,
    usuario: {
      id: asNumber(input.creadoPorId),
      nombre: input.creadoPorId ? `Usuario ${input.creadoPorId}` : "Torreon",
    },
    movimiento: {
      id: asNumber(movimiento.id),
      empresaId,
      localidadId: asNumber(movimiento.localidadId),
      empresa: empresaId
        ? {
            id: empresaId,
            nombre: cleanText(movimiento.empresaNombreSnapshot) || `Empresa ${empresaId}`,
          }
        : undefined,
      locomotiveNumber: movimiento.locomotiveNumber ?? null,
      viaOrigen: { nombre: formatTorreonVia(movimiento, "Origen") },
      viaDestino: { nombre: formatTorreonVia(movimiento, "Destino") },
    },
    _source: "torreon",
  };
}

function getTorreonSearchParams(req: NextRequest, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const params = new URLSearchParams();
  const incoming = req.nextUrl.searchParams;
  const role = readRole(cookieStore);
  const cookieEmpresaId = readEmpresaId(cookieStore);
  const cookieLocalidadId = readLocalidadId(cookieStore);

  const localidadId = incoming.get("localidadId") || (cookieLocalidadId ? String(cookieLocalidadId) : "");
  if (localidadId) params.set("localidadId", localidadId);

  const estado = incoming.get("estado");
  if (estado) params.set("estado", estado);

  params.set("page", incoming.get("page") || "1");
  params.set("pageSize", incoming.get("pageSize") || "20");

  const requestedEmpresaId = incoming.get("empresaId");
  if (canSeeAllEmpresas(role)) {
    if (requestedEmpresaId) params.set("empresaId", requestedEmpresaId);
  } else if (cookieEmpresaId) {
    params.set("empresaId", String(cookieEmpresaId));
  }

  return params;
}

function shouldUseTorreon(req: NextRequest) {
  const source = String(req.nextUrl.searchParams.get("source") || "").toLowerCase();
  return source === "torreon" || isTorreonLocalidad(req.nextUrl.searchParams.get("localidadId") || undefined);
}

async function readJsonBody(req: NextRequest) {
  try {
    return asRecord(await req.json());
  } catch {
    return {};
  }
}

async function proxyCosaif(req: NextRequest, segments: string[]) {
  if (!ORIGIN) return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });

  const search = new URLSearchParams(req.nextUrl.searchParams);
  search.delete("source");
  const pathName = ["incidentes", ...segments].map((segment) => encodeURIComponent(segment)).join("/");
  const url = `${ORIGIN}/${pathName}${search.size ? `?${search.toString()}` : ""}`;

  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value || cookieStore.get("token")?.value || "";
  const headers = new Headers();
  const accept = req.headers.get("accept");
  const contentType = req.headers.get("content-type");
  if (accept) headers.set("accept", accept);
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function listTorreon(req: NextRequest) {
  const cookieStore = await cookies();
  const session = requireTorreonSession(cookieStore);
  if (!session.ok) return session.response;

  const params = getTorreonSearchParams(req, cookieStore);
  const raw = await fetchTorreonMsJson(`/incidentes?${params.toString()}`);
  const record = asRecord(raw);
  const data = asArray(raw).map(mapTorreonIncidente).filter((incidente) => assertTorreonAccess(cookieStore, incidente));

  return NextResponse.json({
    success: true,
    data,
    meta: asRecord(record.meta),
  });
}

async function getTorreonById(id: string) {
  const cookieStore = await cookies();
  const session = requireTorreonSession(cookieStore);
  if (!session.ok) return session.response;

  const raw = await fetchTorreonMsJson(`/incidentes/${encodeURIComponent(id)}`);
  const data = mapTorreonIncidente(asRecord(raw));
  if (!assertTorreonAccess(cookieStore, data)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json({ success: true, data });
}

async function resolveTorreon(req: NextRequest, id: string) {
  const cookieStore = await cookies();
  const session = requireTorreonSession(cookieStore);
  if (!session.ok) return session.response;

  const userId = readUserId(cookieStore);
  if (!userId) return NextResponse.json({ success: false, error: "Usuario no identificado" }, { status: 401 });

  const detail = await fetchTorreonMsJson(`/incidentes/${encodeURIComponent(id)}`);
  const mapped = mapTorreonIncidente(asRecord(detail));
  if (!assertTorreonAccess(cookieStore, mapped)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const body = await readJsonBody(req);
  const solucion =
    cleanText(body.solucion) ||
    cleanText(body.comentario) ||
    cleanText(body.comments) ||
    "Resuelto desde Cosaif Web";

  const data = await fetchTorreonMsJson(`/incidentes/${encodeURIComponent(id)}/resolver`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resueltoPorId: userId, solucion }),
  });
  return NextResponse.json({ success: true, data });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const segments = path.filter(Boolean);
  const [id, action] = segments;

  if (shouldUseTorreon(req)) {
    if (req.method === "GET" && segments.length === 0) return listTorreon(req);
    if (req.method === "GET" && id && segments.length === 1) return getTorreonById(id);
    if (id && ["resuelto", "resolver", "cerrar"].includes(String(action || "").toLowerCase())) {
      return resolveTorreon(req, id);
    }
    if (req.method === "PUT" && id && segments.length === 1) return resolveTorreon(req, id);
    return NextResponse.json({ success: false, error: "Operacion Torreon no soportada" }, { status: 400 });
  }

  return proxyCosaif(req, segments);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
