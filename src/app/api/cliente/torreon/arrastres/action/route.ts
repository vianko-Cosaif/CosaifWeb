import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { canViewTorreonArrastreRole } from "@/lib/torreonLocalidad";

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

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    const userId = readUserId(cookieStore);

    if (!canViewTorreonArrastreRole(role)) {
      return jsonError("No autorizado para operar arrastres", 403);
    }
    if (!userId) {
      return jsonError("No se encontro usuario en sesion", 403);
    }

    const body = await req.json().catch(() => ({})) as JsonRecord;
    const action = String(body.action || "").toUpperCase();
    const arrastreId = asPositiveInt(body.arrastreId);

    if (!arrastreId) {
      return jsonError("Arrastre invalido", 400);
    }

    const arrastre = await getArrastreForAccess(arrastreId, role, empresaId);

    if (action === "INICIAR_VAGON" || action === "FINALIZAR_VAGON") {
      return jsonError("El cliente no puede iniciar ni finalizar vagones", 403);
    }

    if (action === "EDITAR_VAGON") {
      const vagonId = asPositiveInt(body.vagonId);
      if (!vagonId) return jsonError("Vagon invalido", 400);

      const payload: JsonRecord = {};
      const numeroVagon = typeof body.numeroVagon === "string" ? body.numeroVagon.trim() : "";
      const carga = typeof body.carga === "string" ? body.carga.trim().toUpperCase() : "";
      const viaId = body.viaId === undefined ? null : asPositiveInt(body.viaId);
      const seccionId = body.seccionId === undefined ? null : asPositiveInt(body.seccionId);

      if (numeroVagon) payload.numeroVagon = numeroVagon;
      if (carga) {
        if (carga !== "VACIO" && carga !== "LLENO") return jsonError("Carga invalida", 400);
        payload.carga = carga;
      }
      if (body.viaId !== undefined) {
        if (!viaId) return jsonError("Via invalida", 400);
        payload.viaId = viaId;
      }
      if (body.seccionId !== undefined) {
        if (!seccionId) return jsonError("Seccion invalida", 400);
        payload.seccionId = seccionId;
      }
      if (!Object.keys(payload).length) return jsonError("Envia al menos un campo para editar", 400);

      const data = await fetchTorreonMsJson(`/arrastres/${arrastreId}/vagones/${vagonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      if (fotos.length !== 4) return jsonError("El incidente requiere exactamente 4 fotos", 400);

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
