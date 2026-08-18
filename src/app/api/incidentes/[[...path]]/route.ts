import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";
import { isTrainingIncidentId } from "@/lib/routePolicy";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";
import type { VerifiedSession } from "@/lib/sessionToken";

export const dynamic = "force-dynamic";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);
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

function isLocalityScoped(session: VerifiedSession) {
  return session.authorization.scope.mode === "LOCALITY"
    || session.authorization.scope.mode === "COMPANY_LOCALITY";
}

function isCompanyScoped(session: VerifiedSession) {
  return session.authorization.scope.mode === "COMPANY"
    || session.authorization.scope.mode === "COMPANY_LOCALITY";
}

function getIncidentLocalidadId(input: unknown) {
  const root = asRecord(input);
  const incidente = asRecord(root.data && !Array.isArray(root.data) ? root.data : root);
  const movimiento = asRecord(incidente.movimiento);
  const localidad = asRecord(incidente.localidad);
  const movimientoLocalidad = asRecord(movimiento.localidad);
  const ronda = asRecord(incidente.ronda);
  const arrastre = asRecord(incidente.arrastre);
  return (
    asNumber(incidente.localidadId) ||
    asNumber(localidad.id) ||
    asNumber(movimiento.localidadId) ||
    asNumber(movimientoLocalidad.id) ||
    asNumber(ronda.localidadId) ||
    asNumber(arrastre.localidadId)
  );
}

function getIncidentEmpresaId(input: unknown) {
  const root = asRecord(input);
  const incidente = asRecord(root.data && !Array.isArray(root.data) ? root.data : root);
  const movimiento = asRecord(incidente.movimiento);
  const empresa = asRecord(incidente.empresa);
  const movimientoEmpresa = asRecord(movimiento.empresa);
  const arrastre = asRecord(incidente.arrastre);
  return (
    asNumber(incidente.empresaId) ||
    asNumber(empresa.id) ||
    asNumber(movimiento.empresaId) ||
    asNumber(movimientoEmpresa.id) ||
    asNumber(arrastre.empresaId)
  );
}

function localityScopeError(session: VerifiedSession) {
  if (!isLocalityScoped(session)) return null;
  if (session.localidadId) return null;
  return NextResponse.json(
    { success: false, error: "No hay una localidad asignada a la sesión" },
    { status: 403 }
  );
}

function companyScopeError(session: VerifiedSession) {
  if (!isCompanyScoped(session)) return null;
  if (session.empresaId) return null;
  return NextResponse.json(
    { success: false, error: "No hay una empresa asignada a la sesión" },
    { status: 403 }
  );
}

function incidentMatchesSessionScope(
  session: VerifiedSession,
  incident: unknown
) {
  const localidadId = session.localidadId;
  const empresaId = session.empresaId;
  const incidentLocalidadId = getIncidentLocalidadId(incident);
  const incidentEmpresaId = getIncidentEmpresaId(incident);

  if (isLocalityScoped(session) && (!localidadId || !incidentLocalidadId || localidadId !== incidentLocalidadId)) {
    return false;
  }
  if (isCompanyScoped(session) && (!empresaId || !incidentEmpresaId || empresaId !== incidentEmpresaId)) {
    return false;
  }
  return true;
}

function requireTorreonSession(session: VerifiedSession | null) {
  if (!session || !hasPermission(session.authorization, PERMISSIONS.INCIDENTS_READ)) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 }) };
  }
  return { ok: true as const, session };
}

function assertTorreonAccess(
  session: VerifiedSession,
  incidente: ReturnType<typeof mapTorreonIncidente>
) {
  const empresaId = session.empresaId;
  const localidadId = session.localidadId;
  const incidenteEmpresaId = asNumber(incidente.movimiento?.empresaId);
  const incidenteLocalidadId = asNumber(incidente.localidadId);

  if (isLocalityScoped(session)) {
    if (!localidadId || !incidenteLocalidadId || localidadId !== incidenteLocalidadId) return false;
  }
  if (!isCompanyScoped(session)) return true;
  return Boolean(empresaId && incidenteEmpresaId && empresaId === incidenteEmpresaId);
}

function formatTorreonRef(snapshot: unknown, fallbackPrefix: string, id: unknown) {
  const snapshotText = cleanText(snapshot);
  if (snapshotText) return snapshotText;
  const numericId = asNumber(id);
  return numericId ? `${fallbackPrefix} ${numericId}` : null;
}

function formatTorreonVia(movimiento: UnknownRecord, prefix: "Origen" | "Destino") {
  const key = prefix === "Origen" ? "Origen" : "Destino";
  const via = formatTorreonRef(movimiento[`via${key}NombreSnapshot`], "Vía", movimiento[`via${key}Id`]);
  const seccion = formatTorreonRef(movimiento[`seccion${key}NombreSnapshot`], "Sección", movimiento[`seccion${key}Id`]);
  if (via && seccion) return `${via} / ${seccion}`;
  return via || seccion || null;
}

function formatTorreonZona(viaId: unknown, seccionId: unknown) {
  const via = formatTorreonRef(null, "Vía", viaId);
  const seccion = formatTorreonRef(null, "Sección", seccionId);
  if (via && seccion) return `${via} / ${seccion}`;
  return via || seccion || null;
}

function normalizeTorreonTipo(input: UnknownRecord) {
  const value = String(input._torreonTipo || input.tipoIncidente || input.tipo || "").toUpperCase();
  if (value.includes("ARRASTRE")) return "ARRASTRE";
  if (value.includes("NATURAL")) return "NATURAL";
  if (input.arrastre || input.arrastreId) return "ARRASTRE";
  return "NATURAL";
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
  const tipoIncidente = normalizeTorreonTipo(input);
  const isArrastre = tipoIncidente === "ARRASTRE";
  const movimiento = asRecord(input.movimiento);
  const arrastre = asRecord(input.arrastre);
  const vagon = asRecord(input.vagon);
  const empresaId = isArrastre ? asNumber(arrastre.empresaId) : asNumber(movimiento.empresaId);
  const localidadId =
    asNumber(input.localidadId) ||
    (isArrastre ? asNumber(arrastre.localidadId) : asNumber(movimiento.localidadId));
  const arrastreId = asNumber(input.arrastreId) || asNumber(arrastre.id);
  const vagonId = asNumber(input.vagonId) || asNumber(vagon.id);
  const viaBloqueadaId = asNumber(input.viaBloqueadaId);
  const seccionBloqueadaId = asNumber(input.seccionBloqueadaId);
  const fotos = normalizeTorreonFotos(input.fotos);
  const imagenes = fotos.map((foto) => foto.url);
  const movimientoId = asNumber(movimiento.idTecnico) || asNumber(movimiento.id);
  const routeOrigen = isArrastre
    ? formatTorreonZona(
        vagon.viaOrigenId ?? arrastre.viaOrigenId ?? viaBloqueadaId,
        vagon.seccionOrigenId ?? arrastre.seccionOrigenId ?? seccionBloqueadaId
      )
    : formatTorreonVia(movimiento, "Origen");
  const routeDestino = isArrastre
    ? formatTorreonZona(
        vagon.viaId ?? arrastre.viaDestinoId ?? viaBloqueadaId,
        vagon.seccionId ?? arrastre.seccionDestinoId ?? seccionBloqueadaId
      )
    : formatTorreonVia(movimiento, "Destino");

  return {
    id: asNumber(input.id) ?? input.id,
    descripcion: cleanText(input.motivo) || (isArrastre ? "Incidente de arrastre Torreón" : "Incidente de ronda natural en Torreón"),
    motivo: cleanText(input.motivo),
    solucion: cleanText(input.solucion),
    estado: cleanText(input.estado) || "ABIERTO",
    fechaInicio: cleanText(input.fechaInicio),
    fechaResolucion: cleanText(input.fechaResolucion),
    creadoPorId: asNumber(input.creadoPorId),
    resueltoPorId: asNumber(input.resueltoPorId),
    localidadId,
    viaBloqueadaId,
    seccionBloqueadaId,
    arrastreId,
    vagonId,
    tipoIncidente,
    imagenes,
    imagen1: imagenes[0],
    imagen2: imagenes[1],
    imagen3: imagenes[2],
    imagen4: imagenes[3],
    fotosCount: asNumber(asRecord(input._count).fotos) ?? fotos.length,
    fotos,
    usuario: {
      id: asNumber(input.creadoPorId),
      nombre: input.creadoPorId ? `Usuario ${input.creadoPorId}` : "Torreón",
    },
    resueltoPor: input.resueltoPorId
      ? {
          id: asNumber(input.resueltoPorId),
          nombre: `Usuario ${input.resueltoPorId}`,
        }
      : undefined,
    movimiento: {
      id: isArrastre ? arrastreId : movimientoId,
      empresaId,
      localidadId,
      empresa: empresaId
        ? {
            id: empresaId,
            nombre:
              cleanText(isArrastre ? arrastre.empresaNombreSnapshot : movimiento.empresaNombreSnapshot) ||
              `Empresa ${empresaId}`,
          }
        : undefined,
      locomotiveNumber: isArrastre ? `Arrastre #${arrastreId ?? input.id}` : movimiento.locomotiveNumber ?? null,
      viaOrigen: { nombre: routeOrigen },
      viaDestino: { nombre: routeDestino },
    },
    arrastre: isArrastre
      ? {
          ...arrastre,
          id: arrastreId,
          empresaId,
          localidadId,
        }
      : undefined,
    vagon: isArrastre ? { ...vagon, id: vagonId } : undefined,
    _source: "torreon",
    _torreonTipo: tipoIncidente,
  };
}

function getTorreonSearchParams(req: NextRequest, session: VerifiedSession) {
  const params = new URLSearchParams();
  const incoming = req.nextUrl.searchParams;
  const scopedEmpresaId = session.empresaId;
  const scopedLocalidadId = session.localidadId;

  const localidadId = isLocalityScoped(session)
    ? scopedLocalidadId ? String(scopedLocalidadId) : ""
    : incoming.get("localidadId") || "";
  if (localidadId) params.set("localidadId", localidadId);

  const estado = incoming.get("estado");
  if (estado) params.set("estado", estado);

  const tipo = incoming.get("tipo") || incoming.get("tipoIncidente");
  if (tipo) params.set("tipo", tipo);

  params.set("page", incoming.get("page") || "1");
  params.set("pageSize", incoming.get("pageSize") || "20");
  params.set("includeFotos", incoming.get("includeFotos") || "0");

  const requestedEmpresaId = incoming.get("empresaId");
  if (!isCompanyScoped(session)) {
    if (requestedEmpresaId) params.set("empresaId", requestedEmpresaId);
  } else if (scopedEmpresaId) {
    params.set("empresaId", String(scopedEmpresaId));
  }

  return params;
}

function shouldUseTorreon(req: NextRequest, session: VerifiedSession) {
  if (isLocalityScoped(session)) {
    return isTorreonLocalidad(session.localidadId || undefined);
  }
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

async function proxyCosaif(req: NextRequest, segments: string[], session: VerifiedSession) {
  if (!ORIGIN) return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });

  const cookieStore = await cookies();
  const scopeError = localityScopeError(session);
  if (scopeError) return scopeError;
  const empresaScopeError = companyScopeError(session);
  if (empresaScopeError) return empresaScopeError;
  const scopedLocalidadId = isLocalityScoped(session) ? session.localidadId : null;
  const scopedEmpresaId = isCompanyScoped(session) ? session.empresaId : null;

  const search = new URLSearchParams(req.nextUrl.searchParams);
  search.delete("source");
  if (scopedLocalidadId) search.set("localidadId", String(scopedLocalidadId));
  if (scopedEmpresaId) search.set("empresaId", String(scopedEmpresaId));
  const pathName = ["incidentes", ...segments].map((segment) => encodeURIComponent(segment)).join("/");
  const url = `${ORIGIN}/${pathName}${search.size ? `?${search.toString()}` : ""}`;

  const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value || cookieStore.get("token")?.value || "";
  const headers = new Headers();
  const accept = req.headers.get("accept");
  const contentType = req.headers.get("content-type");
  if (accept) headers.set("accept", accept);
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  if ((scopedLocalidadId || scopedEmpresaId) && segments[0] && !["GET", "HEAD"].includes(req.method)) {
    const detailParams = new URLSearchParams();
    if (scopedLocalidadId) detailParams.set("localidadId", String(scopedLocalidadId));
    if (scopedEmpresaId) detailParams.set("empresaId", String(scopedEmpresaId));
    const detailUrl = `${ORIGIN}/incidentes/${encodeURIComponent(segments[0])}?${detailParams.toString()}`;
    const detailResponse = await fetch(detailUrl, { headers, cache: "no-store" });
    const detail = detailResponse.ok ? await detailResponse.json().catch(() => null) : null;
    if (!detailResponse.ok || !incidentMatchesSessionScope(session, detail)) {
      return NextResponse.json(
        { success: false, error: "Solo puedes gestionar incidentes de tu empresa y localidad" },
        { status: 403 }
      );
    }
  }

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
    if ((scopedLocalidadId || scopedEmpresaId) && req.method === "GET" && segments.length === 1 && upstream.ok) {
      try {
        const detail = JSON.parse(new TextDecoder().decode(body));
        if (!incidentMatchesSessionScope(session, detail)) {
          return NextResponse.json(
            { success: false, error: "Solo puedes consultar incidentes de tu empresa y localidad" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "No se pudo validar la localidad del incidente" },
          { status: 403 }
        );
      }
    }
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

async function listTorreon(req: NextRequest, verified: VerifiedSession) {
  const access = requireTorreonSession(verified);
  if (!access.ok) return access.response;
  const scopeError = localityScopeError(verified);
  if (scopeError) return scopeError;
  const empresaScopeError = companyScopeError(verified);
  if (empresaScopeError) return empresaScopeError;

  const params = getTorreonSearchParams(req, verified);
  const raw = await fetchTorreonMsJson(`/incidentes?${params.toString()}`);
  const record = asRecord(raw);
  const data = asArray(raw).map(mapTorreonIncidente).filter((incidente) => assertTorreonAccess(verified, incidente));

  return NextResponse.json({
    success: true,
    data,
    meta: asRecord(record.meta),
  });
}

function getTorreonTipo(req: NextRequest) {
  const tipo = String(req.nextUrl.searchParams.get("tipo") || req.nextUrl.searchParams.get("tipoIncidente") || "").toUpperCase();
  return tipo.includes("ARRASTRE") ? "ARRASTRE" : tipo.includes("NATURAL") ? "NATURAL" : "";
}

async function getTorreonById(req: NextRequest, id: string, verified: VerifiedSession) {
  const access = requireTorreonSession(verified);
  if (!access.ok) return access.response;
  const scopeError = localityScopeError(verified);
  if (scopeError) return scopeError;
  const empresaScopeError = companyScopeError(verified);
  if (empresaScopeError) return empresaScopeError;

  const tipo = getTorreonTipo(req);
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  const raw = await fetchTorreonMsJson(`/incidentes/${encodeURIComponent(id)}${query}`);
  const data = mapTorreonIncidente(asRecord(raw));
  if (!assertTorreonAccess(verified, data)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json({ success: true, data });
}

async function mutateTorreonIncident(req: NextRequest, id: string, action: "resolver" | "cerrar", verified: VerifiedSession) {
  const access = requireTorreonSession(verified);
  if (!access.ok) return access.response;
  const scopeError = localityScopeError(verified);
  if (scopeError) return scopeError;
  const empresaScopeError = companyScopeError(verified);
  if (empresaScopeError) return empresaScopeError;
  if (!hasPermission(verified.authorization, PERMISSIONS.INCIDENTS_RESOLVE)) {
    return NextResponse.json({ success: false, error: "No autorizado para gestionar incidentes" }, { status: 403 });
  }

  const userId = verified.userId;

  const tipo = getTorreonTipo(req);
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  const detail = await fetchTorreonMsJson(`/incidentes/${encodeURIComponent(id)}${query}`);
  const mapped = mapTorreonIncidente(asRecord(detail));
  if (!assertTorreonAccess(verified, mapped)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const body = await readJsonBody(req);
  const solucion =
    cleanText(body.solucion) ||
    cleanText(body.comentario) ||
    cleanText(body.comments) ||
    (action === "cerrar"
      ? "Incidente cerrado y movimiento cancelado desde Cosaif Web"
      : "Resuelto desde Cosaif Web");

  const data = await fetchTorreonMsJson(`/incidentes/${encodeURIComponent(id)}/${action}${query}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resueltoPorId: userId, solucion }),
  });
  return NextResponse.json({ success: true, data });
}

function requiredIncidentPermission(method: string, action: string | undefined) {
  const normalizedAction = String(action || "").toLowerCase();
  if (["resuelto", "resolver", "cerrar"].includes(normalizedAction)) return PERMISSIONS.INCIDENTS_RESOLVE;
  if (method === "GET" || method === "HEAD") return PERMISSIONS.INCIDENTS_READ;
  if (method === "POST") return PERMISSIONS.INCIDENTS_CREATE;
  if (method === "DELETE") return PERMISSIONS.INCIDENTS_DELETE;
  return PERMISSIONS.INCIDENTS_UPDATE;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const segments = path.filter(Boolean);
  const [id, action] = segments;

  if (id && isTrainingIncidentId(id)) {
    return NextResponse.json(
      { success: false, error: "Los incidentes SIM sólo existen dentro de la capacitación." },
      { status: 409 }
    );
  }

  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sesion no valida" }, { status: 401 });
  }
  const requiredPermission = requiredIncidentPermission(req.method, action);
  if (!hasPermission(session.authorization, requiredPermission)) {
    return NextResponse.json({ success: false, error: "No autorizado para esta operacion" }, { status: 403 });
  }

  if (shouldUseTorreon(req, session)) {
    if (req.method === "GET" && segments.length === 0) return listTorreon(req, session);
    if (req.method === "GET" && id && segments.length === 1) return getTorreonById(req, id, session);
    if (id && ["resuelto", "resolver"].includes(String(action || "").toLowerCase())) {
      return mutateTorreonIncident(req, id, "resolver", session);
    }
    if (id && String(action || "").toLowerCase() === "cerrar") {
      return mutateTorreonIncident(req, id, "cerrar", session);
    }
    if (req.method === "PUT" && id && segments.length === 1) {
      return mutateTorreonIncident(req, id, "resolver", session);
    }
    return NextResponse.json({ success: false, error: "Operacion Torreon no soportada" }, { status: 400 });
  }

  return proxyCosaif(req, segments, session);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
