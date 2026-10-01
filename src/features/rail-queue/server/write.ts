import "server-only";
import { fetchUpstream } from "@/lib/server/upstream";
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { fetchTorreonMsJson, isTorreonLocalidad, TorreonMsError } from "@/lib/torreonMs";
import { containsTrainingReservedId } from "@/lib/routePolicy";
import { getVerifiedSession } from "@/lib/server/session";
import type { VerifiedSession } from "@/lib/sessionToken";
import type { RondaInfoRecord, MovimientoRecord } from "./models";
import { mapTorreonRondasToOut } from "./torreon";
import { asRecord, firstPositiveNumber } from "./mapping";
import {
  getApiBase,
  authHeaders,
  fetchRondaInfo,
  readTextAsJsonSafe,
  fetchMovimientoDetail,
} from "./transport";

function isClientEditor(session: VerifiedSession) {
  return ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(session.role);
}

function isLocalityScoped(session: VerifiedSession) {
  return (
    isClientEditor(session) ||
    session.authorization.scope.mode === "LOCALITY" ||
    session.authorization.scope.mode === "COMPANY_LOCALITY"
  );
}

function isCompanyScoped(session: VerifiedSession) {
  return (
    isClientEditor(session) ||
    session.authorization.scope.mode === "COMPANY" ||
    session.authorization.scope.mode === "COMPANY_LOCALITY"
  );
}

function getInfoEmpresaId(info: RondaInfoRecord | null) {
  return Number(info?.empresa?.id ?? info?.movimiento?.empresa?.id ?? info?.movimiento?.empresaId ?? NaN) || null;
}

function getInfoLocalidadId(info: RondaInfoRecord | null) {
  return firstPositiveNumber(info?.movimiento?.localidadId, info?.movimiento?.localidad?.id);
}

function getMovimientoLocalidadId(movimiento: MovimientoRecord | null) {
  return firstPositiveNumber(movimiento?.localidadId, movimiento?.localidad?.id);
}

function assertEmpresaScope(
  shouldScopeEmpresa: boolean,
  empresaId: number | null,
  targetEmpresaIds: Array<number | null>,
) {
  if (!shouldScopeEmpresa) return;
  if (!empresaId) {
    throw new Error("No se pudo validar tu empresa.");
  }
  if (targetEmpresaIds.some((id) => id !== empresaId)) {
    throw new Error("Solo puedes modificar movimientos de tu empresa.");
  }
}

function assertLocalidadScope(
  localidadId: number | null,
  targetLocalidadIds: Array<number | null>,
) {
  if (!localidadId) throw new Error("No se pudo validar tu localidad.");
  if (targetLocalidadIds.some((id) => id !== localidadId)) {
    throw new Error("Solo puedes modificar movimientos de tu localidad.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { origin } = new URL(req.url);
    const body = asRecord(await req.json().catch(() => ({})));
    if (containsTrainingReservedId(body)) {
      return NextResponse.json(
        { message: "Los registros SIM sólo existen dentro de la capacitación." },
        { status: 409 },
      );
    }
    const action = String(body?.action || "").toLowerCase();

    const cookieStore = await cookies();
    const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
    if (!token) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role === "ARRASTRE_TORREON")
      return NextResponse.json({ message: "Tu perfil sólo permite arrastres." }, { status: 403 });
    const requiredPermission =
      action === "cancel" ? PERMISSIONS.MOVEMENTS_CANCEL : PERMISSIONS.ROUNDS_EDIT;
    if (!hasPermission(session.authorization, requiredPermission)) {
      return NextResponse.json({ message: "No autorizado para esta accion" }, { status: 403 });
    }

    const empresaId = session.empresaId;
    const assignedLocalidadId = session.localidadId;
    const requestedLocalidadId = firstPositiveNumber(body?.localidadId);
    if (
      isLocalityScoped(session) &&
      requestedLocalidadId &&
      requestedLocalidadId !== assignedLocalidadId
    ) {
      return NextResponse.json(
        { message: "Solo puedes modificar rondas de tu localidad." },
        { status: 403 },
      );
    }
    const scopedLocalidadId = isLocalityScoped(session)
      ? assignedLocalidadId
      : requestedLocalidadId;
    if (!scopedLocalidadId) {
      return NextResponse.json(
        { message: "No hay una localidad asignada a la sesion." },
        { status: 403 },
      );
    }
    body.localidadId = scopedLocalidadId;
    const shouldScopeEmpresa = isCompanyScoped(session);
    if (shouldScopeEmpresa && !empresaId) {
      return NextResponse.json(
        { message: "No hay una empresa asignada a la sesion." },
        { status: 403 },
      );
    }
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);
    const jsonHeaders = { ...headers, "content-type": "application/json" };

    if (isTorreonLocalidad(scopedLocalidadId)) {
      if (action === "orden") {
        const id = Number(body?.id ?? body?.rondaMovimientoId);
        const orden = Number(body?.orden);
        if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(orden) || orden <= 0) {
          return NextResponse.json({ message: "Faltan id y orden:number" }, { status: 400 });
        }

        // HMAC upstream requests use service credentials: validate the signed-in
        // viewer's company and patio here before authorizing the mutation.
        const params = new URLSearchParams({ localidadId: String(scopedLocalidadId) });
        if (shouldScopeEmpresa) params.set("empresaId", String(empresaId));
        const raw = await fetchTorreonMsJson(`/rondas?${params}`, { signal: req.signal });
        const allowed = mapTorreonRondasToOut(raw, false, shouldScopeEmpresa ? empresaId : null, scopedLocalidadId);
        if (!allowed.some(round => round.id === id)) {
          return NextResponse.json({ message: "Solo puedes modificar movimientos de tu empresa y localidad." }, { status: 403 });
        }
        const payload = {
          rondaMovimientoId: id,
          orden,
          ...(shouldScopeEmpresa && empresaId ? { empresaId } : {}),
        };
        const data = await fetchTorreonMsJson("/rondas/movimientos/orden", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return NextResponse.json(data, { status: 200 });
      }

      return NextResponse.json(
        {
          message:
            "Las rondas de Torreon se consultan desde ms_torreon; esta accion no aplica para Torreon.",
        },
        { status: 409 },
      );
    }

    if (action === "swap" || action === "orden") {
      const swap = action === "swap";
      const ids = (swap ? [body.rondaAId, body.rondaBId] : [body.id]).map(Number);
      const orden = Number(body.orden);
      if (
        ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        (!swap && (!Number.isSafeInteger(orden) || orden <= 0))
      ) {
        return NextResponse.json(
          { message: swap ? "Faltan rondaAId y rondaBId numéricos" : "Faltan id y orden:number" },
          { status: 400 },
        );
      }
      if (!swap && shouldScopeEmpresa) {
        return NextResponse.json({ message: "Intercambia únicamente movimientos de tu empresa para conservar las posiciones de otros clientes." }, { status: 403 });
      }
      try {
        const rounds = await Promise.all(
          ids.map((id) => fetchRondaInfo(base, headers, id, req.signal)),
        );
        assertEmpresaScope(shouldScopeEmpresa, empresaId, rounds.map(getInfoEmpresaId));
        assertLocalidadScope(scopedLocalidadId, rounds.map(getInfoLocalidadId));
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo validar la ronda.";
        return NextResponse.json(
          { message },
          { status: message.includes("Solo puedes") ? 403 : 400 },
        );
      }
      const path = swap ? "/rondas/intercambiar-movimientos" : `/rondas/${ids[0]}/orden`;
      const payload = swap ? { rondaAId: ids[0], rondaBId: ids[1] } : { orden };
      const response = await fetchUpstream(
        `${base}${path}`,
        {
          method: swap ? "PATCH" : "PUT",
          headers: jsonHeaders,
          body: JSON.stringify(payload),
          cache: "no-store",
        },
        req.signal,
      );
      return NextResponse.json(await readTextAsJsonSafe(response), {
        status: response.ok ? 200 : response.status,
      });
    }

    if (action === "cancel") {
      const movimientoId = Number(body?.movimientoId);
      const razon = String(body?.razon || "Cancelado por cliente");
      if (!Number.isFinite(movimientoId) || movimientoId <= 0) {
        return NextResponse.json({ message: "Falta movimientoId numérico" }, { status: 400 });
      }

      try {
        const movimiento = await fetchMovimientoDetail(base, headers, movimientoId, req.signal);
        const targetEmpresaId = Number(movimiento?.empresa?.id ?? movimiento?.empresaId ?? NaN) || null;
        assertEmpresaScope(shouldScopeEmpresa, empresaId, [targetEmpresaId]);
        assertLocalidadScope(scopedLocalidadId, [getMovimientoLocalidadId(movimiento)]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo validar el movimiento.";
        return NextResponse.json(
          { message },
          { status: message.includes("Solo puedes") ? 403 : 400 },
        );
      }

      const response = await fetchUpstream(
        `${base}/movimientos/${encodeURIComponent(String(movimientoId))}/cancelar`,
        {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({ razon }),
          cache: "no-store",
        },
      );
      const data = await readTextAsJsonSafe(response);
      return NextResponse.json(data, { status: response.ok ? 200 : response.status });
    }

    return NextResponse.json({ message: "Acción no soportada" }, { status: 400 });
  } catch (err) {
    if (err instanceof TorreonMsError && [403, 404, 409].includes(err.status))
      return NextResponse.json({ message: err.message }, { status: err.status });
    console.error("[api/cliente/rondas] POST error:", err);
    return NextResponse.json({ message: "Error inesperado" }, { status: 500 });
  }
}
