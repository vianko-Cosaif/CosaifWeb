import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { canViewTorreonArrastreRole } from "@/lib/torreonLocalidad";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";

export const dynamic = "force-dynamic";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type ArrastreRecord = Record<string, unknown>;

function readRole(cookieStore: CookieStore) {
  return String(cookieStore.get(process.env.ROLE_COOKIE_NAME || "role")?.value || "").toUpperCase();
}

function readEmpresaId(cookieStore: CookieStore) {
  return (
    Number(cookieStore.get("empresaId")?.value) ||
    Number(cookieStore.get("empId")?.value) ||
    Number(cookieStore.get("empresald")?.value) ||
    null
  );
}

function readUserId(cookieStore: CookieStore) {
  return (
    Number(cookieStore.get("userId")?.value) ||
    Number(cookieStore.get("uid")?.value) ||
    Number(cookieStore.get("usuarioId")?.value) ||
    null
  );
}

function canSeeAllEmpresas(role: string) {
  return ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR"].includes(role);
}

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
  return extractArray(input).map((item) => ({
    ...item,
    id: asNumber(item.id) ?? item.id,
    estado: cleanText(item.estado) || "ABIERTO",
    motivo: cleanText(item.motivo),
    solucion: cleanText(item.solucion),
    fechaInicio: cleanText(item.fechaInicio),
    fechaResolucion: cleanText(item.fechaResolucion),
    viaBloqueadaId: asNumber(item.viaBloqueadaId),
    seccionBloqueadaId: asNumber(item.seccionBloqueadaId),
    vagonId: asNumber(item.vagonId),
    fotos: mapFotos(item.fotos),
  }));
}

function mapArrastre(input: ArrastreRecord) {
  const record = asRecord(input);
  return {
    ...record,
    incidentes: mapIncidentes(record.incidentes),
  };
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

  return input
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const carga = String(record.carga || "VACIO").toUpperCase();
      return {
        numeroVagon: typeof record.numeroVagon === "string" && record.numeroVagon.trim()
          ? record.numeroVagon.trim()
          : undefined,
        carga: carga === "LLENO" ? "LLENO" : "VACIO",
        viaId: Number(record.viaId),
        seccionId: Number(record.seccionId),
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
    const cookieStore = await cookies();
    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    if (!canViewTorreonArrastreRole(role)) {
      return NextResponse.json([], { status: 200 });
    }

    const scopedEmpresaId = canSeeAllEmpresas(role) ? null : empresaId;

    if (!canSeeAllEmpresas(role) && !scopedEmpresaId) {
      return NextResponse.json([], { status: 200 });
    }

    const qs = new URLSearchParams({ localidadId });
    if (estado) qs.set("estado", estado);
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
    const cookieStore = await cookies();
    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    const userId = readUserId(cookieStore);

    if (!canViewTorreonArrastreRole(role)) {
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

    const vagones = normalizeVagones(body.vagones);
    if (vagones.length < 1) return jsonError("Agrega al menos un vagon", 400);
    if (vagones.length > 8) return jsonError("Maximo 8 vagones por arrastre", 400);
    if (vagones.some((item) => !Number.isFinite(item.viaId) || item.viaId <= 0 || !Number.isFinite(item.seccionId) || item.seccionId <= 0)) {
      return jsonError("Cada vagon necesita via y seccion validas", 400);
    }

    const capacidad = vagones.reduce((total, item) => total + (item.carga === "LLENO" ? 2 : 1), 0);
    if (capacidad > 8) {
      return jsonError("Arrastre excede capacidad: vacio=1, lleno=2, maximo=8", 400);
    }

    const payload = {
      empresaId,
      creadoPorId: userId,
      localidadId,
      instrucciones: typeof body.instrucciones === "string" && body.instrucciones.trim()
        ? body.instrucciones.trim()
        : undefined,
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
