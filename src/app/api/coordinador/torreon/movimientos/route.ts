import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";

export const dynamic = "force-dynamic";

type UnknownRecord = Record<string, unknown>;

const ALLOWED_ROLES = new Set([
  "ADMINISTRADOR",
  "COORDINADOR",
  "SUPERVISOR",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
]);

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

function canSeeAllEmpresas(role: string) {
  return ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(role);
}

function requireSession(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value || cookieStore.get("token")?.value;
  const role = readRole(cookieStore);
  if (!token || !ALLOWED_ROLES.has(role)) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  return { ok: true as const, role };
}

function formatRef(snapshot: unknown, fallbackPrefix: string, id: unknown) {
  const text = cleanText(snapshot);
  if (text) return text;
  const numericId = asNumber(id);
  return numericId ? `${fallbackPrefix} ${numericId}` : null;
}

function firstCleanText(input: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(input[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(input: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(input[key]);
    if (value) return value;
  }
  return null;
}

function formatVia(movimiento: UnknownRecord, prefix: "Origen" | "Destino") {
  const via = formatRef(movimiento[`via${prefix}NombreSnapshot`], "Via", movimiento[`via${prefix}Id`]);
  const seccion = formatRef(movimiento[`seccion${prefix}NombreSnapshot`], "Seccion", movimiento[`seccion${prefix}Id`]);
  if (via && seccion) return `${via} / ${seccion}`;
  return via || seccion || null;
}

function mapFotos(input: unknown) {
  return asArray(input)
    .map((foto) => {
      const url = toTorreonImageProxyUrl(foto.url);
      if (!url) return null;
      return {
        id: asNumber(foto.id),
        tipo: cleanText(foto.tipo) || "SIN_TIPO",
        orden: asNumber(foto.orden) ?? 1,
        url,
        comentario: cleanText(foto.comentario),
        tomadaAt: cleanText(foto.tomadaAt),
      };
    })
    .filter((foto): foto is NonNullable<typeof foto> => Boolean(foto));
}

function mapIncidentes(input: unknown) {
  return asArray(input).map((incidente) => {
    const fotos = mapFotos(incidente.fotos);
    return {
      id: asNumber(incidente.id) ?? incidente.id,
      estado: cleanText(incidente.estado) || "ABIERTO",
      motivo: cleanText(incidente.motivo),
      solucion: cleanText(incidente.solucion),
      creadoPorId: asNumber(incidente.creadoPorId) ?? incidente.creadoPorId,
      resueltoPorId: asNumber(incidente.resueltoPorId) ?? incidente.resueltoPorId,
      fechaInicio: cleanText(incidente.fechaInicio),
      fechaResolucion: cleanText(incidente.fechaResolucion),
      viaBloqueadaId: asNumber(incidente.viaBloqueadaId),
      seccionBloqueadaId: asNumber(incidente.seccionBloqueadaId),
      fotosCount: asNumber(asRecord(incidente._count).fotos) ?? fotos.length,
      fotos,
    };
  });
}

function mapMovimiento(input: UnknownRecord) {
  const empresaId = asNumber(input.empresaId);
  const fotos = mapFotos(input.fotos);
  const creadoPorId = firstNumber(input, ["creadoPorId", "usuarioCreacionId", "usuarioId"]);
  const operadorId = firstNumber(input, ["operadorId", "maquinistaId"]);
  const iniciadoPorId = firstNumber(input, ["iniciadoPorId", "usuarioInicioId"]) || operadorId || creadoPorId;
  const operadorNombre = firstCleanText(input, [
    "operadorNombre",
    "operadorNombreSnapshot",
    "maquinistaNombre",
    "maquinistaNombreSnapshot",
  ]);
  const creadoPorNombre = firstCleanText(input, ["creadoPorNombre", "creadoPorNombreSnapshot", "usuarioCreacionNombre"]);
  const iniciadoPorNombre =
    firstCleanText(input, ["iniciadoPorNombre", "iniciadoPorNombreSnapshot", "usuarioInicioNombre"]) ||
    operadorNombre ||
    creadoPorNombre;
  return {
    id: asNumber(input.id) ?? input.id,
    empresaId,
    empresaNombre: cleanText(input.empresaNombreSnapshot) || (empresaId ? `Empresa ${empresaId}` : "Empresa"),
    localidadId: asNumber(input.localidadId),
    clienteId: firstNumber(input, ["clienteId"]),
    clienteNombre: firstCleanText(input, ["clienteNombre", "clienteNombreSnapshot"]),
    supervisorId: firstNumber(input, ["supervisorId"]),
    supervisorNombre: firstCleanText(input, ["supervisorNombre", "supervisorNombreSnapshot"]),
    coordinadorId: firstNumber(input, ["coordinadorId"]),
    coordinadorNombre: firstCleanText(input, ["coordinadorNombre", "coordinadorNombreSnapshot"]),
    operadorId,
    operadorNombre,
    creadoPorId,
    creadoPorNombre,
    iniciadoPorId,
    iniciadoPorNombre,
    locomotiveNumber: input.locomotiveNumber ?? null,
    estado: cleanText(input.estado) || "SOLICITADO",
    prioridad: cleanText(input.prioridad) || "BAJA",
    tipoMovimiento: cleanText(input.tipoMovimiento),
    viaOrigen: formatVia(input, "Origen"),
    viaDestino: formatVia(input, "Destino"),
    fechaSolicitud: cleanText(input.fechaSolicitud),
    fechaInicio: cleanText(input.fechaInicio),
    fechaFin: cleanText(input.fechaFin),
    instrucciones: cleanText(input.instrucciones),
    fotosCount: asNumber(asRecord(input._count).fotos) ?? fotos.length,
    fotos,
    fotosPorTipo: {
      ANTES_MOVIMIENTO: fotos.filter((foto) => foto.tipo === "ANTES_MOVIMIENTO"),
      PROCESO_MOVIMIENTO: fotos.filter((foto) => foto.tipo === "PROCESO_MOVIMIENTO"),
      FIN_MOVIMIENTO: fotos.filter((foto) => foto.tipo === "FIN_MOVIMIENTO"),
    },
    incidentes: mapIncidentes(input.incidentes),
  };
}

function isConcluido(estado: string) {
  return ["CONCLUIDO", "CANCELADO"].includes(estado.toUpperCase());
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = requireSession(cookieStore);
    if (!session.ok) return session.response;

    const { searchParams } = new URL(req.url);
    const localidadId = searchParams.get("localidadId");
    if (!localidadId || !isTorreonLocalidad(localidadId)) {
      return NextResponse.json({ error: "Localidad Torreon requerida" }, { status: 400 });
    }

    const detailId = asNumber(searchParams.get("id"));
    if (detailId) {
      const raw = await fetchTorreonMsJson(`/movimientos/${detailId}`);
      const data = mapMovimiento(asRecord(raw));
      const empresaId = readEmpresaId(cookieStore);
      if (!canSeeAllEmpresas(session.role) && empresaId && data.empresaId !== empresaId) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
      }
      if (String(data.localidadId || "") !== String(localidadId)) {
        return NextResponse.json({ success: false, error: "Movimiento fuera de localidad" }, { status: 403 });
      }
      return NextResponse.json({ success: true, data });
    }

    const params = new URLSearchParams({ localidadId });
    const empresaId = readEmpresaId(cookieStore);
    const requestedEmpresaId = asNumber(searchParams.get("empresaId"));
    if (canSeeAllEmpresas(session.role) && requestedEmpresaId) params.set("empresaId", String(requestedEmpresaId));
    if (!canSeeAllEmpresas(session.role) && empresaId) params.set("empresaId", String(empresaId));
    const status = String(searchParams.get("status") || "activos").toLowerCase();
    if (status === "concluidos") params.set("vista", "historial");
    if (status === "activos") params.set("vista", "activos");
    params.set("page", searchParams.get("page") || "1");
    params.set("pageSize", searchParams.get("pageSize") || "60");
    params.set("includeFotos", searchParams.get("includeFotos") || "0");

    const raw = await fetchTorreonMsJson(`/movimientos?${params.toString()}`);
    const query = cleanText(searchParams.get("q"))?.toLowerCase() || "";
    const data = asArray(raw)
      .map(mapMovimiento)
      .filter((movimiento) => {
        if (status === "concluidos") return isConcluido(String(movimiento.estado));
        if (status === "todos") return true;
        return !isConcluido(String(movimiento.estado));
      })
      .filter((movimiento) => {
        if (!query) return true;
        return [
          movimiento.id,
          movimiento.empresaNombre,
          movimiento.locomotiveNumber,
          movimiento.estado,
          movimiento.viaOrigen,
          movimiento.viaDestino,
        ]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(query));
      });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar movimientos Torreon";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
