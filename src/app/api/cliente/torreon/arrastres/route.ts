import { NextRequest, NextResponse } from "next/server";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { canResolveTorreonIncidentRole, canViewTorreonArrastreRole } from "@/lib/torreonLocalidad";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";
import { ARRASTRE_MAX_CAPACITY, ARRASTRE_MIN_VAGONES, arrastreVagonCapacity } from "@/features/torreon/arrastres/constants";
import { PERMISSIONS, hasAnyPermission, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

type ArrastreRecord = Record<string, unknown>;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function extractArray(input: unknown): ArrastreRecord[] {
  if (Array.isArray(input)) return input as ArrastreRecord[];
  if (input && typeof input === "object") {
    const record = input as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as ArrastreRecord[];
    if (Array.isArray(record.items)) return record.items as ArrastreRecord[];
    if (Array.isArray(record.rows)) return record.rows as ArrastreRecord[];
  }
  return [];
}

function asRecord(input: unknown): ArrastreRecord {
  return input && typeof input === "object" ? input as ArrastreRecord : {};
}

function asNumber(input: unknown) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function cleanText(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : null;
}

function mapFotos(input: unknown) {
  return extractArray(input)
    .map((foto) => {
      const url = toTorreonImageProxyUrl(foto.url);
      if (!url) return null;
      return {
        id: asNumber(foto.id),
        orden: asNumber(foto.orden) ?? 1,
        url,
        storageKey: cleanText(foto.storageKey),
        comentario: cleanText(foto.comentario),
        tomadaAt: cleanText(foto.tomadaAt),
      };
    })
    .filter((foto): foto is NonNullable<typeof foto> => Boolean(foto));
}

function mapIncidentes(input: unknown) {
  return extractArray(input).map((item) => {
    const fotos = mapFotos(item.fotos);
    return {
      ...item,
      id: asNumber(item.id) ?? item.id,
      estado: cleanText(item.estado) || "ABIERTO",
      motivo: cleanText(item.motivo),
      solucion: cleanText(item.solucion),
      creadoPorId: asNumber(item.creadoPorId) ?? item.creadoPorId,
      resueltoPorId: asNumber(item.resueltoPorId) ?? item.resueltoPorId,
      fechaInicio: cleanText(item.fechaInicio),
      fechaResolucion: cleanText(item.fechaResolucion),
      viaBloqueadaId: asNumber(item.viaBloqueadaId),
      seccionBloqueadaId: asNumber(item.seccionBloqueadaId),
      vagonId: asNumber(item.vagonId),
      fotosCount: asNumber(asRecord(item._count).fotos) ?? fotos.length,
      fotos,
    };
  });
}

function mapArrastre(input: ArrastreRecord) {
  const record = asRecord(input);
  return {
    ...record,
    incidentes: mapIncidentes(record.incidentes),
  };
}

function unwrapDetail(input: unknown): ArrastreRecord {
  if (Array.isArray(input)) return asRecord(input[0]);
  const record = asRecord(input);
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) return asRecord(record.data);
  if (record.item && typeof record.item === "object" && !Array.isArray(record.item)) return asRecord(record.item);
  return record;
}

function filterByVista(rows: ArrastreRecord[], vista: string | null) {
  const normalized = String(vista || "").toUpperCase();
  if (!normalized) return rows;

  const cerrados = new Set(["CONCLUIDO", "CANCELADO"]);
  if (["HISTORIAL", "COMPLETADOS", "CERRADOS"].includes(normalized)) {
    return rows.filter((item) => cerrados.has(String(item.estado || "").toUpperCase()));
  }
  if (["ACTIVOS", "ABIERTOS", "PENDIENTES"].includes(normalized)) {
    return rows.filter((item) => !cerrados.has(String(item.estado || "").toUpperCase()));
  }

  return rows;
}

function normalizeVagones(input: unknown) {
  if (!Array.isArray(input)) return [];

  const asText = (...values: unknown[]) => {
    for (const value of values) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return "";
  };

  return input
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const carga = String(record.carga || "VACIO").toUpperCase();
      const viaOrigenId = asText(record.viaOrigenId);
      const seccionOrigenId = asText(record.seccionOrigenId);
      const viaDestinoId = asText(record.viaId, record.viaDestinoId);
      const seccionDestinoId = asText(record.seccionId, record.seccionDestinoId);
      const viaOrigenNombre = asText(record.viaOrigenNombre, record.viaOrigen, viaOrigenId);
      const seccionOrigenNombre = asText(record.seccionOrigenNombre, record.seccionOrigen, seccionOrigenId);
      const viaDestinoNombre = asText(record.viaDestinoNombre, record.viaDestino, viaDestinoId);
      const seccionDestinoNombre = asText(record.seccionDestinoNombre, record.seccionDestino, seccionDestinoId);
      return {
        numeroVagon: typeof record.numeroVagon === "string" ? record.numeroVagon.trim() : "",
        carga: carga === "LLENO" ? "LLENO" : "VACIO",
        viaOrigenId,
        seccionOrigenId,
        viaId: viaDestinoId,
        seccionId: seccionDestinoId,
        viaOrigenNombre,
        seccionOrigenNombre,
        viaDestinoNombre,
        seccionDestinoNombre,
        viaOrigen: viaOrigenNombre,
        seccionOrigen: seccionOrigenNombre,
        viaDestino: viaDestinoNombre,
        seccionDestino: seccionDestinoNombre,
      };
    });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const localidadId = searchParams.get("localidadId");
    if (!localidadId || !isTorreonLocalidad(localidadId)) {
      return NextResponse.json([], { status: 200 });
    }

    const estado = searchParams.get("estado");
    const vista = searchParams.get("vista");
    const id = asNumber(searchParams.get("id"));
    const auditId = asNumber(searchParams.get("auditId"));
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");
    const includeFotos = searchParams.get("includeFotos");
    const session = await getVerifiedSession();
    if (!session || !hasAnyPermission(session.authorization, [PERMISSIONS.TORREON_READ, PERMISSIONS.INCIDENTS_READ])) {
      return jsonError("No autorizado", 401);
    }
    const role = session.role;
    const empresaId = session.empresaId;
    const sessionLocalidadId = session.localidadId;
    const localityScoped = session.authorization.scope.mode === "LOCALITY" || session.authorization.scope.mode === "COMPANY_LOCALITY";
    const companyScoped = session.authorization.scope.mode === "COMPANY" || session.authorization.scope.mode === "COMPANY_LOCALITY";
    const generalLocalityView = searchParams.get("alcance") === "localidad" && !id && !auditId;
    if (!canViewTorreonArrastreRole(role) && !canResolveTorreonIncidentRole(role)) {
      return NextResponse.json([], { status: 200 });
    }

    if (
      generalLocalityView &&
      localityScoped &&
      sessionLocalidadId &&
      sessionLocalidadId !== Number(localidadId)
    ) {
      return jsonError("No autorizado para consultar otra localidad", 403);
    }

    if (auditId) {
      if (role !== "ADMINISTRADOR") return jsonError("Solo administración puede consultar la bitácora de ediciones", 403);
      const detail = mapArrastre(unwrapDetail(await fetchTorreonMsJson(`/arrastres/${auditId}?includeFotos=false`))) as ArrastreRecord;
      if (asNumber(detail.localidadId) !== Number(localidadId)) return jsonError("Bitácora fuera de la localidad seleccionada", 403);
      const data = await fetchTorreonMsJson(`/arrastres/${auditId}/ediciones`);
      return NextResponse.json(extractArray(data), { status: 200 });
    }

    const scopedEmpresaId = companyScoped ? empresaId : null;

    if (companyScoped && !scopedEmpresaId) {
      return NextResponse.json([], { status: 200 });
    }

    if (id) {
      const detailQs = new URLSearchParams();
      if (includeFotos) detailQs.set("includeFotos", includeFotos);
      const data = await fetchTorreonMsJson(`/arrastres/${id}${detailQs.size ? `?${detailQs.toString()}` : ""}`);
      const mapped = mapArrastre(unwrapDetail(data)) as ArrastreRecord;
      const recordLocalidadId = asNumber(mapped.localidadId);
      const recordEmpresaId = asNumber(mapped.empresaId);

      if (recordLocalidadId && recordLocalidadId !== Number(localidadId)) {
        return jsonError("No autorizado para este arrastre", 403);
      }
      if (scopedEmpresaId && recordEmpresaId && recordEmpresaId !== scopedEmpresaId) {
        return jsonError("No autorizado para este arrastre", 403);
      }

      return NextResponse.json(mapped, { status: 200 });
    }

    const qs = new URLSearchParams({ localidadId });
    if (estado) qs.set("estado", estado);
    if (vista) qs.set("vista", vista);
    if (page) qs.set("page", page);
    if (pageSize) qs.set("pageSize", pageSize);
    if (includeFotos) qs.set("includeFotos", includeFotos);
    if (generalLocalityView) qs.set("alcance", "localidad");
    if (scopedEmpresaId) qs.set("empresaId", String(scopedEmpresaId));

    const data = await fetchTorreonMsJson(`/arrastres?${qs.toString()}`);
    return NextResponse.json(filterByVista(extractArray(data).map(mapArrastre), vista), { status: 200 });
  } catch (error) {
    console.error("[api/cliente/torreon/arrastres] error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) return jsonError("No autorizado", 401);
    const role = session.role;
    const empresaId = session.empresaId;
    const userId = session.userId;

    if (!canViewTorreonArrastreRole(role) || !hasPermission(session.authorization, PERMISSIONS.TORREON_CREATE)) {
      return jsonError("No autorizado para crear arrastres", 403);
    }
    if (!empresaId) {
      return jsonError("No se encontro empresa en sesion", 403);
    }
    if (!userId) {
      return jsonError("No se encontro usuario en sesion", 403);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const localidadId = Number(body.localidadId);
    if (!Number.isFinite(localidadId) || !isTorreonLocalidad(localidadId)) {
      return jsonError("Localidad Torreon invalida", 400);
    }
    if (
      (session.authorization.scope.mode === "LOCALITY" || session.authorization.scope.mode === "COMPANY_LOCALITY") &&
      session.localidadId !== localidadId
    ) {
      return jsonError("Solo puedes crear arrastres en tu localidad.", 403);
    }
    const instrucciones = typeof body.instrucciones === "string" ? body.instrucciones.trim() : "";
    if (instrucciones.length < 3) {
      return jsonError("Describe el movimiento u operacion del arrastre", 400);
    }

    const vagones = normalizeVagones(body.vagones);
    if (vagones.length < ARRASTRE_MIN_VAGONES) return jsonError("Agrega al menos un vagón", 400);
    if (vagones.length > ARRASTRE_MAX_CAPACITY) return jsonError("Máximo 8 vagones por arrastre", 400);
    if (vagones.some((item) => !item.numeroVagon)) {
      return jsonError("Cada vagón necesita un número", 400);
    }
    if (vagones.some((item) => item.numeroVagon.length > 40)) {
      return jsonError("El número de vagón no puede superar 40 caracteres", 400);
    }
    const normalizedNumbers = vagones.map((item) => item.numeroVagon.toLocaleUpperCase("es-MX"));
    if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
      return jsonError("No repitas el mismo número de vagón", 400);
    }
    if (vagones.some((item) => (
      !item.viaOrigen ||
      !item.seccionOrigen ||
      !item.viaDestino ||
      !item.seccionDestino
    ))) {
      return jsonError("Cada vagon necesita origen y destino con via/seccion", 400);
    }

    const capacidad = vagones.reduce((total, item) => total + arrastreVagonCapacity(item.carga), 0);
    if (capacidad > ARRASTRE_MAX_CAPACITY) {
      return jsonError("Arrastre excede capacidad: vacío=1, lleno=2, máximo=8", 400);
    }

    const payload = {
      empresaId,
      creadoPorId: userId,
      localidadId,
      instrucciones,
      vagones,
    };

    const data = await fetchTorreonMsJson("/arrastres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[api/cliente/torreon/arrastres] post error:", error);
    return jsonError(error instanceof Error ? error.message : "No se pudo crear el arrastre", 400);
  }
}
