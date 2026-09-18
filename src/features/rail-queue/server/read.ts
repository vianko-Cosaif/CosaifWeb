import "server-only";
import { fetchUpstream, getErrorStatus } from "@/lib/server/upstream";
import { mapConcurrent } from "@/lib/http/concurrency";
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { fetchTorreonMsJson, isTorreonLocalidad, TorreonMsError } from "@/lib/torreonMs";
import { getVerifiedSession } from "@/lib/server/session";
import {
  MovementScopeError,
  recordMatchesMovementScope,
  resolveMovementReadScope,
} from "@/lib/auth/movementScope";
import type { RondaOut, RondaInfoRecord } from "./models";
import {
  normalizeMovimientoCollection,
  firstPositiveNumber,
  movementToRondaOut,
  normalizeRondas,
  readDetailRecord,
  projectClientCurrentRounds,
  sortRondaQueue,
} from "./mapping";
import { readRondasJson, fetchRondasJsonFirst, getApiBase, authHeaders } from "./transport";
import { RondasReadError } from "./errors";
import { readTornoRounds } from "./torno";
import { mapTorreonRondasToOut } from "./torreon";

async function fetchCosaifRondasOut({
  base,
  headers,
  localidadId,
  concluido,
  empresaScopeId,
  generalLocalityView,
  signal,
}: {
  base: string;
  headers: HeadersInit;
  localidadId: string;
  concluido: boolean;
  empresaScopeId?: number | null;
  generalLocalityView?: boolean;
  signal: AbortSignal;
}): Promise<RondaOut[]> {
  if (concluido && !generalLocalityView) {
    const qs = new URLSearchParams({
      localidadId,
      ambito: "pasados",
      page: "1",
      pageSize: "100",
    });
    if (empresaScopeId) qs.set("empresaId", String(empresaScopeId));

    const response = await fetchUpstream(
      `${base}/movimientos/buscar?${qs.toString()}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
      signal,
    );

    return normalizeMovimientoCollection(await readRondasJson(response))
      .filter((mv) => {
        return recordMatchesMovementScope(
          {
            empresaId: firstPositiveNumber(mv.empresaId, mv.empresa?.id),
            localidadId: firstPositiveNumber(mv.localidadId, mv.localidad?.id),
          },
          { empresaId: empresaScopeId ?? null, localidadId: Number(localidadId) },
        );
      })
      .map((mv, index) => movementToRondaOut(mv, index, true))
      .filter((item): item is RondaOut => Boolean(item));
  }

  const scopeParams = new URLSearchParams({ localidadId, concluido: String(concluido) });
  if (generalLocalityView) scopeParams.set("alcance", "localidad");
  if (empresaScopeId) scopeParams.set("empresaId", String(empresaScopeId));
  const candidates = [
    `${base}/rondas/localidad/${encodeURIComponent(localidadId)}/estado/${concluido ? "true" : "false"}?${scopeParams.toString()}`,
    `${base}/rondas?${scopeParams.toString()}`,
  ];

  const raw = await fetchRondasJsonFirst(candidates, headers, signal);

  const baseList = normalizeRondas(raw).filter(
    (round) =>
      round.concluido === concluido &&
      (concluido ||
        !["CONCLUIDO", "CANCELADO", "RESUELTO"].includes(
          String(round.movimiento?.estado ?? "").toUpperCase(),
        )),
  );
  if (!baseList.length) return [];

  const infoPairs = generalLocalityView
    ? []
    : await mapConcurrent(
        baseList.filter(
          (r) =>
            !r.movimiento ||
            !["estado", "viaOrigen", "viaDestino", "locomotiveNumber"].every(
              (key) => key in r.movimiento!,
            ) ||
            !r.empresa,
        ),
        4,
        async (r) => {
          const info = await fetchRondasJsonFirst(
            [
              `${base}/movimientos/ronda/${encodeURIComponent(String(r.id))}/info`,
              `${base}/rondas/${encodeURIComponent(String(r.id))}/info`,
            ],
            headers,
            signal,
          );
          return [r.id, readDetailRecord(info) as RondaInfoRecord] as const;
        },
      );
  const infoMap = new Map<number, RondaInfoRecord | null>(infoPairs);

  const mapped: RondaOut[] = [];
  for (const r of baseList) {
    const info = infoMap.get(r.id);
    const baseMv = r.movimiento ?? null;
    const baseEmp = r.empresa ?? baseMv?.empresa ?? null;
    const mv = info?.movimiento ?? baseMv;
    const emp = info?.empresa ?? mv?.empresa ?? baseEmp;
    const empresaId = firstPositiveNumber(emp?.id, mv?.empresaId);
    const movementLocalidadId = firstPositiveNumber(
      r.localidadId,
      mv?.localidadId,
      mv?.localidad?.id,
    );
    if (
      !recordMatchesMovementScope(
        { empresaId, localidadId: movementLocalidadId },
        { empresaId: empresaScopeId ?? null, localidadId: Number(localidadId) },
      )
    )
      continue;
    const movimientoId = mv
      ? firstPositiveNumber(mv.idTecnico, info?.movimientoId, r.movimientoId, mv.id)
      : (r.movimientoId ?? null);
    const visibleId = mv ? (firstPositiveNumber(mv.folioLocalidad, mv.id) ?? movimientoId) : null;

    mapped.push({
      ...r,
      empresa: emp ? { id: Number(emp.id ?? 0), nombre: String(emp.nombre ?? "—") } : null,
      movimiento: mv
        ? {
            id: visibleId ?? undefined,
            idTecnico: movimientoId,
            folioLocalidad: mv.folioLocalidad ?? visibleId ?? null,
            folioLocalidadLabel: mv.folioLocalidadLabel ?? (visibleId ? `#${visibleId}` : null),
            viaOrigen: mv.viaOrigen ?? null,
            viaDestino: mv.viaDestino ?? null,
            lavado: Boolean(mv.lavado ?? mv.Lavado),
            torno: Boolean(mv.torno),
            estado: mv.estado ?? null,
            prioridad: mv.prioridad ?? null,
            locomotiveNumber: mv.locomotiveNumber ?? mv.locomotora ?? null,
            locomotora: mv.locomotora ?? null,
            fechaSolicitud: mv.fechaSolicitud ?? mv.createdAt ?? null,
            createdAt: mv.createdAt ?? null,
            tipoMovimiento: mv.tipoMovimiento ?? null,
            accion: mv.accion ?? null,
            fechaInicio: mv.fechaInicio ?? null,
            fechaFin: mv.fechaFin ?? null,
            instrucciones: mv.instrucciones ?? null,
          }
        : null,
      movimientoId,
      createdAt: mv?.fechaSolicitud ?? mv?.createdAt ?? r.createdAt ?? null,
      source: "cosaif",
    });
  }

  return mapped.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
}

export async function GET(req: NextRequest) {
  const controller = new AbortController();
  const signal = AbortSignal.any([req.signal, controller.signal]);
  try {
    const { searchParams, origin } = new URL(req.url);
    const entity = String(searchParams.get("entity") ?? "movimientos").toLowerCase();
    const estado = String(
      searchParams.get("estado") ?? searchParams.get("tab") ?? "pendientes",
    ).toLowerCase();
    const concluido = estado === "terminados" || estado === "finalizados" || estado === "true";
    const requestedGeneralLocalityView = searchParams.get("alcance") === "localidad";

    const cookieStore = await cookies();
    const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
    const session = await getVerifiedSession();
    if (!token || !session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role === "ARRASTRE_TORREON")
      return NextResponse.json({ message: "Tu perfil sólo permite arrastres." }, { status: 403 });
    if (!hasPermission(session.authorization, PERMISSIONS.ROUNDS_READ)) {
      return NextResponse.json({ message: "No autorizado para consultar rondas" }, { status: 403 });
    }
    const { authorization } = session;
    const editing = searchParams.get("editing") === "1";
    const clientEditor = editing && ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(session.role);
    const readScope = resolveMovementReadScope(
      clientEditor ? { ...session, role: "CLIENTE" } : session,
      editing ? "detail" : concluido ? "history-list" : "current-list",
      searchParams,
    );
    const { empresaId, localidadId } = readScope;
    const generalLocalityView =
      readScope.sharedCurrentLocality ||
      (!editing && session.role !== "CLIENTE" &&
        requestedGeneralLocalityView &&
        authorization.capabilities.canViewAllCompanies);

    if (!localidadId) {
      return NextResponse.json(
        { message: "No hay una localidad asignada a la sesion." },
        { status: 403 },
      );
    }

    const localidadIdParam = String(localidadId);
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);

    if (entity === "torneados") {
      const out = await readTornoRounds({
        base,
        headers,
        signal,
        concluido,
        localidadId,
        empresaId,
        ownEmpresaId: session.empresaId,
        sharedCurrentLocality: readScope.sharedCurrentLocality,
      });
      return NextResponse.json(
        projectClientCurrentRounds(out, readScope.sharedCurrentLocality, session.empresaId),
        { status: 200 },
      );
    }

    if (isTorreonLocalidad(localidadIdParam)) {
      const scopedEmpresaId = empresaId;
      const canReadTorreon = hasPermission(authorization, PERMISSIONS.TORREON_READ);
      if (!canReadTorreon) return NextResponse.json<RondaOut[]>([], { status: 200 });

      const params = new URLSearchParams({ localidadId: localidadIdParam });
      if (generalLocalityView) params.set("alcance", "localidad");
      if (concluido) params.set("estado", "CERRADA");
      if (scopedEmpresaId) params.set("empresaId", String(scopedEmpresaId));
      const raw = await fetchTorreonMsJson(`/rondas?${params.toString()}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
      });
      const out = mapTorreonRondasToOut(raw, concluido, scopedEmpresaId, localidadId);

      return NextResponse.json(
        projectClientCurrentRounds(
          sortRondaQueue(out),
          readScope.sharedCurrentLocality,
          session.empresaId,
        ),
        { status: 200 },
      );
    }

    const empresaScopeId = empresaId;
    const out = await fetchCosaifRondasOut({
      base,
      headers,
      localidadId: localidadIdParam,
      concluido,
      empresaScopeId,
      generalLocalityView,
      signal,
    });
    return NextResponse.json(
      projectClientCurrentRounds(out, readScope.sharedCurrentLocality, session.empresaId),
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof MovementScopeError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    const status =
      err instanceof RondasReadError
        ? err.status
        : err instanceof TorreonMsError
          ? // GET Torreón usa credenciales HMAC de servicio, no la sesión del
            // usuario. Un rechazo del microservicio no debe cerrar esa sesión.
            err.status === 408 || err.status === 504
            ? 504
            : 502
          : getErrorStatus(err);
    const message =
      status === 401
        ? "La sesión de operación terminó. Vuelve a iniciar sesión."
        : status === 403
          ? "No estás autorizado para consultar estas rondas."
          : status === 504
            ? "La consulta de rondas tardó demasiado. Inténtalo de nuevo."
            : "No se pudieron cargar las rondas. Inténtalo de nuevo.";
    console.error("[api/cliente/rondas] error:", err);
    return NextResponse.json({ message }, { status, headers: { "cache-control": "no-store" } });
  } finally {
    // Detiene también consultas de detalle paralelas si una de ellas falla.
    controller.abort();
  }
}
