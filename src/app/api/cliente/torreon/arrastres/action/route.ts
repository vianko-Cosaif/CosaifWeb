import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { canResolveTorreonIncidentRole, canViewTorreonArrastreRole } from "@/lib/torreonLocalidad";
import { ARRASTRE_MAX_CAPACITY, ARRASTRE_MIN_VAGONES, arrastreVagonCapacity } from "@/features/torreon/arrastres/constants";

export const dynamic = "force-dynamic";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type JsonRecord = Record<string, unknown>;
type FotoInput = {
  dataUrl?: string;
  base64?: string;
  contenidoBase64?: string;
  url?: string;
  mimeType?: string;
  comentario?: string;
  tomadaPorId?: number;
};

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

function canOperatePatio(role: string) {
  return ["COORDINADOR", "SUPERVISOR"].includes(role);
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asRecord(input: unknown): JsonRecord {
  return input && typeof input === "object" ? input as JsonRecord : {};
}

function asPositiveInt(input: unknown) {
  const value = Number(input);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function asText(input: unknown) {
  if (input == null) return "";
  return String(input).trim();
}

function asPositiveIntArray(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => asPositiveInt(item))
    .filter((item): item is number => Boolean(item));
}

function statusText(input: unknown) {
  return String(input || "").trim().toUpperCase();
}

function extractArray(input: unknown): JsonRecord[] {
  if (Array.isArray(input)) return input as JsonRecord[];
  if (input && typeof input === "object") {
    const record = input as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as JsonRecord[];
    if (Array.isArray(record.items)) return record.items as JsonRecord[];
    if (Array.isArray(record.rows)) return record.rows as JsonRecord[];
  }
  return [];
}

function hasVagonEnProceso(arrastre: JsonRecord) {
  return extractArray(arrastre.vagones).some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
}

function hasPendingVagon(arrastre: JsonRecord) {
  return extractArray(arrastre.vagones).some((vagon) => statusText(vagon.estado) === "PENDIENTE");
}

function hasOpenIncident(arrastre: JsonRecord) {
  return extractArray(arrastre.incidentes).some((incidente) => statusText(incidente.estado) === "ABIERTO");
}

function assertArrastreEditable(arrastre: JsonRecord) {
  const estado = statusText(arrastre.estado);
  if (!["SOLICITADO", "DETENIDO"].includes(estado)) {
    return `Arrastre no puede editarse en estado ${estado || "DESCONOCIDO"}`;
  }
  return null;
}

function canReorderArrastre(arrastre: JsonRecord) {
  const estado = statusText(arrastre.estado);
  return ["SOLICITADO", "DETENIDO"].includes(estado) && !hasVagonEnProceso(arrastre);
}

function canPrioritizeArrastre(arrastre: JsonRecord) {
  return canReorderArrastre(arrastre) && hasPendingVagon(arrastre);
}

function orderValue(arrastre: JsonRecord) {
  const value = Number(arrastre.ordenSolicitud);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function solicitudTime(arrastre: JsonRecord) {
  return Date.parse(String(arrastre.fechaSolicitud || arrastre.fechaInicio || "")) || 0;
}

function normalizeFotos(input: unknown, userId: number): FotoInput[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return { dataUrl: item.trim(), tomadaPorId: userId };
      }

      const record = asRecord(item);
      const foto: FotoInput = {
        dataUrl: typeof record.dataUrl === "string" ? record.dataUrl : undefined,
        base64: typeof record.base64 === "string" ? record.base64 : undefined,
        contenidoBase64: typeof record.contenidoBase64 === "string" ? record.contenidoBase64 : undefined,
        url: typeof record.url === "string" ? record.url : undefined,
        mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
        comentario: typeof record.comentario === "string" ? record.comentario : undefined,
        tomadaPorId: userId,
      };

      return foto.dataUrl || foto.base64 || foto.contenidoBase64 || foto.url ? foto : null;
    })
    .filter((foto): foto is FotoInput => Boolean(foto));
}

async function getArrastreForAccess(arrastreId: number, role: string, empresaId: number | null) {
  const arrastre = asRecord(await fetchTorreonMsJson(`/arrastres/${arrastreId}`));
  const localidadId = Number(arrastre.localidadId);
  const arrastreEmpresaId = Number(arrastre.empresaId);

  if (!isTorreonLocalidad(localidadId)) {
    throw new Error("Arrastre fuera de Torreon");
  }

  if (!canSeeAllEmpresas(role)) {
    if (!empresaId || !Number.isFinite(arrastreEmpresaId) || arrastreEmpresaId !== empresaId) {
      throw new Error("Arrastre fuera de la empresa del usuario");
    }
  }

  return arrastre;
}

async function loadPriorityScope(arrastre: JsonRecord, role: string, empresaId: number | null) {
  const localidadId = Number(arrastre.localidadId);
  const qs = new URLSearchParams({ localidadId: String(localidadId) });
  if (!canSeeAllEmpresas(role) && empresaId) qs.set("empresaId", String(empresaId));

  const rows = extractArray(await fetchTorreonMsJson(`/arrastres?${qs.toString()}`))
    .sort((left, right) => orderValue(left) - orderValue(right) || solicitudTime(left) - solicitudTime(right) || Number(left.id) - Number(right.id));

  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    const userId = readUserId(cookieStore);
    const body = await req.json().catch(() => ({})) as JsonRecord;
    const action = String(body.action || "").toUpperCase();

    if (action === "RESOLVER_INCIDENTE") {
      if (!canResolveTorreonIncidentRole(role)) {
        return jsonError("No autorizado para resolver incidentes", 403);
      }
    } else if (!canViewTorreonArrastreRole(role)) {
      return jsonError("No autorizado para operar arrastres", 403);
    }
    if (!userId) {
      return jsonError("No se encontro usuario en sesion", 403);
    }

    const arrastreId = asPositiveInt(body.arrastreId);

    if (!arrastreId) {
      return jsonError("Arrastre invalido", 400);
    }

    const arrastre = await getArrastreForAccess(arrastreId, role, empresaId);

    if (action === "EDITAR_ARRASTRE") {
      if (statusText(arrastre.estado) !== "SOLICITADO") {
        return jsonError(`Solo se puede editar una solicitud antes de iniciar. Estado actual: ${statusText(arrastre.estado)}`, 409);
      }
      const existingVagones = extractArray(arrastre.vagones);
      if (existingVagones.some((vagon) => statusText(vagon.estado) !== "PENDIENTE")) {
        return jsonError("No se puede editar una solicitud que ya tiene vagones operados", 409);
      }

      const instrucciones = asText(body.instrucciones);
      if (instrucciones.length < 3 || instrucciones.length > 1_000) {
        return jsonError("Las instrucciones deben tener entre 3 y 1000 caracteres", 400);
      }
      const motivoEdicion = asText(body.motivoEdicion);
      if (motivoEdicion && (motivoEdicion.length < 3 || motivoEdicion.length > 300)) {
        return jsonError("El motivo de edición debe tener entre 3 y 300 caracteres", 400);
      }

      const rawVagones = Array.isArray(body.vagones) ? body.vagones : [];
      if (rawVagones.length < ARRASTRE_MIN_VAGONES || rawVagones.length > ARRASTRE_MAX_CAPACITY) {
        return jsonError("La solicitud debe conservar entre 1 y 8 vagones", 400);
      }

      const vagones = rawVagones.map((item) => {
        const row = asRecord(item);
        return {
          id: asPositiveInt(row.id),
          numeroVagon: asText(row.numeroVagon),
          carga: statusText(row.carga),
          viaOrigenId: asPositiveInt(row.viaOrigenId),
          seccionOrigenId: asPositiveInt(row.seccionOrigenId),
          viaId: asPositiveInt(row.viaId),
          seccionId: asPositiveInt(row.seccionId),
          viaOrigenNombre: asText(row.viaOrigenNombre),
          seccionOrigenNombre: asText(row.seccionOrigenNombre),
          viaDestinoNombre: asText(row.viaDestinoNombre),
          seccionDestinoNombre: asText(row.seccionDestinoNombre),
        };
      });

      if (vagones.some((vagon) => !vagon.id || !vagon.numeroVagon || !vagon.viaOrigenId || !vagon.seccionOrigenId || !vagon.viaId || !vagon.seccionId)) {
        return jsonError("Cada vagón necesita número, origen y destino completos", 400);
      }
      if (vagones.some((vagon) => !["VACIO", "LLENO"].includes(vagon.carga))) {
        return jsonError("La carga de cada vagón debe ser VACIO o LLENO", 400);
      }
      const inputIds = vagones.map((vagon) => vagon.id as number);
      const existingIds = new Set(existingVagones.map((vagon) => asPositiveInt(vagon.id)).filter((id): id is number => Boolean(id)));
      if (inputIds.length !== existingIds.size || new Set(inputIds).size !== inputIds.length || inputIds.some((id) => !existingIds.has(id))) {
        return jsonError("La edición debe incluir todos los vagones existentes", 400);
      }
      const numbers = vagones.map((vagon) => vagon.numeroVagon.toLocaleUpperCase("es-MX"));
      if (new Set(numbers).size !== numbers.length) return jsonError("No repitas el mismo número de vagón", 400);
      const capacidad = vagones.reduce((total, vagon) => total + arrastreVagonCapacity(vagon.carga), 0);
      if (capacidad > ARRASTRE_MAX_CAPACITY) return jsonError("Capacidad excedida: vacío=1, lleno=2, máximo=8", 400);

      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrucciones,
          vagones,
          editadoPorId: userId,
          editadoPorRol: role,
          ...(motivoEdicion ? { motivoEdicion } : {}),
        }),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "INICIAR_VAGON" || action === "FINALIZAR_VAGON") {
      if (!canOperatePatio(role)) {
        return jsonError("Solo coordinación puede iniciar o finalizar vagones", 403);
      }

      const vagonId = asPositiveInt(body.vagonId);
      if (!vagonId) return jsonError("Vagón inválido", 400);
      const path = action === "INICIAR_VAGON"
        ? `/arrastres/${arrastreId}/vagones/${vagonId}/iniciar`
        : `/arrastres/${arrastreId}/vagones/${vagonId}/finalizar`;
      const data = await fetchTorreonMsJson(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(action === "INICIAR_VAGON" ? { iniciadoPorId: userId } : {}),
          ...(body.confirmarIncidente ? { confirmarIncidente: true } : {}),
          ...(typeof body.comentarioOperacion === "string" && body.comentarioOperacion.trim()
            ? { comentarioOperacion: body.comentarioOperacion.trim() }
            : {}),
        }),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "EDITAR_VAGON") {
      const editError = assertArrastreEditable(arrastre);
      if (editError) return jsonError(editError, 409);

      const vagonId = asPositiveInt(body.vagonId);
      if (!vagonId) return jsonError("Vagon invalido", 400);

      const payload: JsonRecord = {};
      const numeroVagon = typeof body.numeroVagon === "string" ? body.numeroVagon.trim() : "";
      const carga = typeof body.carga === "string" ? body.carga.trim().toUpperCase() : "";
      const viaOrigen = body.viaOrigen ?? body.viaOrigenNombre ?? body.viaOrigenId;
      const seccionOrigen = body.seccionOrigen ?? body.seccionOrigenNombre ?? body.seccionOrigenId;
      const viaDestino = body.viaDestino ?? body.viaDestinoNombre ?? body.viaId;
      const seccionDestino = body.seccionDestino ?? body.seccionDestinoNombre ?? body.seccionId;

      if (!numeroVagon) return jsonError("El número de vagón es obligatorio", 400);
      payload.numeroVagon = numeroVagon;
      if (carga) {
        if (carga !== "VACIO" && carga !== "LLENO") return jsonError("Carga invalida", 400);
        payload.carga = carga;
      }
      if (viaOrigen !== undefined) {
        const value = asText(viaOrigen);
        if (!value) return jsonError("Via origen invalida", 400);
        payload.viaOrigen = value;
      }
      if (seccionOrigen !== undefined) {
        const value = asText(seccionOrigen);
        if (!value) return jsonError("Seccion origen invalida", 400);
        payload.seccionOrigen = value;
      }
      if (viaDestino !== undefined) {
        const value = asText(viaDestino);
        if (!value) return jsonError("Via destino invalida", 400);
        payload.viaDestino = value;
      }
      if (seccionDestino !== undefined) {
        const value = asText(seccionDestino);
        if (!value) return jsonError("Seccion destino invalida", 400);
        payload.seccionDestino = value;
      }
      if (!Object.keys(payload).length) return jsonError("Envia al menos un campo para editar", 400);

      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}/vagones/${vagonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "REORDENAR_VAGONES") {
      const editError = assertArrastreEditable(arrastre);
      if (editError) return jsonError(editError, 409);

      const vagonIds = asPositiveIntArray(body.vagonIds);
      if (!vagonIds.length) return jsonError("Orden de vagones invalido", 400);
      if (new Set(vagonIds).size !== vagonIds.length) return jsonError("No repitas vagones", 400);

      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}/vagones/orden`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vagonIds }),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "REORDENAR_SOLICITUDES") {
      const editError = assertArrastreEditable(arrastre);
      if (editError) return jsonError(editError, 409);

      const arrastreIds = asPositiveIntArray(body.arrastreIds);
      if (!arrastreIds.length) return jsonError("Orden de solicitudes invalido", 400);
      if (new Set(arrastreIds).size !== arrastreIds.length) return jsonError("No repitas solicitudes", 400);

      const data = await fetchTorreonMsJson("/arrastres/orden-solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrastreIds,
          ...(!canSeeAllEmpresas(role) && empresaId ? { empresaId } : {}),
        }),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "PRIORIZAR_SOLICITUD") {
      if (!canPrioritizeArrastre(arrastre)) {
        return jsonError("Solo puedes subir solicitudes solicitadas o detenidas sin vagon en proceso", 409);
      }

      const scopeRows = await loadPriorityScope(arrastre, role, empresaId);
      if (!scopeRows.some(hasOpenIncident)) {
        return jsonError("Solo se puede priorizar cuando existe un incidente abierto en la cola", 409);
      }

      const editableRows = scopeRows.filter(canReorderArrastre);
      const target = editableRows.find((item) => Number(item.id) === arrastreId);
      if (!target) {
        return jsonError("Solicitud no disponible para subir al frente", 409);
      }
      if (!canPrioritizeArrastre(target)) {
        return jsonError("La solicitud no tiene vagones pendientes disponibles para subir al frente", 409);
      }

      const arrastreIds = [
        target.id,
        ...editableRows.filter((item) => Number(item.id) !== arrastreId).map((item) => item.id),
      ].map((item) => Number(item));

      const data = await fetchTorreonMsJson("/arrastres/orden-solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrastreIds,
          ...(!canSeeAllEmpresas(role) && empresaId ? { empresaId } : {}),
        }),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "CREAR_INCIDENTE") {
      const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
      const fotos = normalizeFotos(body.fotos, userId);
      const vagonId = asPositiveInt(body.vagonId);
      const viaBloqueadaId = asPositiveInt(body.viaBloqueadaId);
      const seccionBloqueadaId = asPositiveInt(body.seccionBloqueadaId);

      if (motivo.length < 3) return jsonError("Describe el incidente", 400);
      if (fotos.length < 1 || fotos.length > 4) return jsonError("El incidente requiere entre 1 y 4 fotos", 400);

      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}/incidentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creadoPorId: userId,
          motivo,
          fotos,
          ...(vagonId ? { vagonId } : {}),
          ...(viaBloqueadaId ? { viaBloqueadaId } : {}),
          ...(seccionBloqueadaId ? { seccionBloqueadaId } : {}),
        }),
      });
      return NextResponse.json(data, { status: 201 });
    }

    if (action === "RESOLVER_INCIDENTE") {
      const incidenteId = asPositiveInt(body.incidenteId);
      const solucion = typeof body.solucion === "string" ? body.solucion.trim() : "";
      if (!incidenteId) return jsonError("Incidente invalido", 400);
      if (solucion.length < 3) return jsonError("Describe la solucion", 400);

      const resolved = asRecord(await fetchTorreonMsJson(`/arrastres/${arrastreId}/incidentes/${incidenteId}/resolver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resueltoPorId: userId, solucion }),
      }));

      const estado = String(resolved.estado || arrastre.estado || "").toUpperCase();
      if (estado === "DETENIDO") {
        const reanudado = await fetchTorreonMsJson(`/arrastres/${arrastreId}/reanudar`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return NextResponse.json(reanudado, { status: 200 });
      }

      return NextResponse.json(resolved, { status: 200 });
    }

    if (action === "REANUDAR") {
      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}/reanudar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return NextResponse.json(data, { status: 200 });
    }

    if (action === "CANCELAR") {
      const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}/cancelar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canceladoPorId: userId,
          ...(motivo ? { motivo } : {}),
        }),
      });
      return NextResponse.json(data, { status: 200 });
    }

    return jsonError("Accion de arrastre no soportada", 400);
  } catch (error) {
    console.error("[api/cliente/torreon/arrastres/action] error:", error);
    return jsonError(error instanceof Error ? error.message : "No se pudo operar el arrastre", 400);
  }
}
