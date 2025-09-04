/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useMovimientos.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ================= Tipos ================= */
export type Movement = {
  id: number;
  localidadId?: number;
  localidadNombre?: string;
  empresaId?: number;
  empresaNombre?: string;
  locomotora?: string;
  viaOrigen?: string;
  viaDestino?: string;
  tipoAccion?: string;
  prioridad?: string;
  estado?: string;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string;
  finalizado?: boolean;
  // extras para modal
  posicionCabina?: string;
  posicionChimenea?: string;
  direccionEmpuje?: string;
  incidenteGlobal?: boolean;
  lavado?: boolean;
  torno?: boolean;
};

export type Option = { id: number; nombre: string };

type CursorResp<T> = { items: T[]; hasMore?: boolean; nextCursorId?: number; total?: number };
type PageResp<T> = { rows: T[]; total: number } | T[]; // API flexible

type Mode = "page" | "cursor";

export interface UseMovimientosArgs {
  apiBase?: string;
  initialEmpresas?: Option[];
  initialLocalidades?: Option[];
  defaults?: { empresaId?: number | null; localidadId?: number | null };
  mode?: Mode;
  tab?: "Actuales" | "Pasados";
}

/* =============== Hook =============== */
export function useMovimientos({
  apiBase = "/xapi",
  initialEmpresas = [],
  initialLocalidades = [],
  defaults = {},
  mode = "page",
  tab = "Actuales",
}: UseMovimientosArgs) {
  const PAGE_SIZE = 50;

  // montaje
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // combos
  const [empOpts, setEmpOpts] = useState<Option[]>(initialEmpresas);
  const [locOpts, setLocOpts] = useState<Option[]>(initialLocalidades);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!initialEmpresas.length) {
          const r = await fetch(`${apiBase}/empresas`, { cache: "no-store", credentials: "same-origin" });
          if (r.ok && !dead) {
            const data = await r.json();
            setEmpOpts((data || []).map((x: any) => ({ id: x.id, nombre: x.nombre })));
          }
        }
        if (!initialLocalidades.length) {
          const r = await fetch(`${apiBase}/localidades`, { cache: "no-store", credentials: "same-origin" });
          if (r.ok && !dead) {
            const data = await r.json();
            setLocOpts((data || []).map((x: any) => ({ id: x.id, nombre: x.nombre })));
          }
        }
      } catch {}
    })();
    return () => {
      dead = true;
    };
  }, [apiBase, initialEmpresas.length, initialLocalidades.length]);

  // filtros
  const [filtros, setFiltros] = useState<{
    empresaId: number | null;
    localidadId: number | null;
    from: string;
    to: string;
  }>({
    empresaId: defaults.empresaId ?? null,
    localidadId: defaults.localidadId ?? null,
    from: "",
    to: "",
  });

  // paginación (página) y cursor
  const [page, setPage] = useState(1);
  const [cursorId, setCursorId] = useState<number | undefined>(undefined);
  const cursorBackStack = useRef<number[]>([]); // para volver atrás en modo cursor

  // datos
  const [items, setItems] = useState<Movement[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // detalle
  const [detail, setDetail] = useState<Movement | null>(null);
  const openDetail = (m: Movement) => setDetail(m);
  const closeDetail = () => setDetail(null);

  // auto-refresh
  const [auto, setAuto] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mov:auto") !== "0";
  });
  useEffect(() => {
    try {
      localStorage.setItem("mov:auto", auto ? "1" : "0");
    } catch {}
  }, [auto]);

  // request guard
  const reqSeq = useRef(0);

  // carga
  const load = useCallback(
    async (showRefreshing = false) => {
      const my = ++reqSeq.current;
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams();
        if (filtros.empresaId != null) params.append("empresaId", String(filtros.empresaId));
        if (filtros.localidadId != null) params.append("localidadId", String(filtros.localidadId));
        if (filtros.from) params.append("fechaInicio", filtros.from);
        if (filtros.to) params.append("fechaFin", filtros.to);
        if (tab === "Pasados") params.append("finalizado", "true");

        if (mode === "page") {
          params.append("page", String(page));
          params.append("pageSize", String(PAGE_SIZE));
        } else {
          params.append("take", String(PAGE_SIZE));
          if (cursorId) params.append("cursorId", String(cursorId));
        }

        const url = `${apiBase}/movimientos?${params.toString()}`;
        const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (my !== reqSeq.current) return;

        // Normaliza respuesta
        let nextItemsRaw: any[] = [];
        let nextTotal = 0;
        let nextHasMore = false;
        let nextCursor: number | undefined = undefined;

        if (Array.isArray(data)) {
          nextItemsRaw = data;
          nextTotal = data.length;
        } else if ("rows" in data) {
          nextItemsRaw = data.rows ?? [];
          nextTotal = Number(data.total ?? nextItemsRaw.length);
        } else if ("items" in data) {
          nextItemsRaw = data.items ?? [];
          nextTotal = Number(data.total ?? 0);
          nextHasMore = Boolean(data.hasMore);
          nextCursor = data.nextCursorId;
        } else {
          nextItemsRaw = data?.rows ?? [];
          nextTotal = Number(data?.total ?? nextItemsRaw.length);
        }

        const adapted: Movement[] = nextItemsRaw.map(adaptMovimiento);

        // si tab=Actuales, filtramos por no finalizado cuando el backend no lo hizo
        const ensureByTab =
          tab === "Actuales" ? adapted.filter((m) => !m.finalizado) : adapted.filter((m) => m.finalizado);

        setItems(ensureByTab);
        setTotal(nextTotal);

        // cursor bookkeeping
        if (mode === "cursor") {
          (load as any)._hasMore = nextHasMore;
          (load as any)._nextCursor = nextCursor;
        }
      } catch {
        setItems([]);
        setTotal(0);
        if (mode === "cursor") {
          (load as any)._hasMore = false;
          (load as any)._nextCursor = undefined;
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, filtros.empresaId, filtros.localidadId, filtros.from, filtros.to, tab, page, mode, cursorId]
  );

  // auto-refresh visible
  useEffect(() => {
    if (!auto) return;
    const tick = () => {
      if (document.visibilityState === "visible") load(false);
    };
    const id = window.setInterval(tick, 20000);
    const onVis = () => document.visibilityState === "visible" && load(false);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [auto, load]);

  // disparadores
  useEffect(() => {
    load(false);
  }, [load]);

  // reset pag/cursor ante cambios fuertes
  useEffect(() => {
    setPage(1);
    setCursorId(undefined);
    cursorBackStack.current = [];
  }, [filtros.empresaId, filtros.localidadId, filtros.from, filtros.to, tab, mode]);

  // helpers cursor
  const hasMore = useMemo(() => {
    if (mode === "page") {
      // si el backend no manda total, infiere por longitud
      if (!total) return items.length >= PAGE_SIZE;
      return page * PAGE_SIZE < total;
    }
    return Boolean((load as any)._hasMore);
  }, [mode, items.length, PAGE_SIZE, page, total, load]);

  const nextPage = mode === "cursor"
    ? () => {
        const nextC = (load as any)._nextCursor as number | undefined;
        if (!nextC) return;
        if (cursorId) cursorBackStack.current.push(cursorId);
        setCursorId(nextC);
      }
    : undefined;

  const prevPage = mode === "cursor"
    ? () => {
        const prev = cursorBackStack.current.pop();
        setCursorId(prev);
      }
    : undefined;

  const reload = (showRefreshing = false) => load(showRefreshing);

  return {
    // estado
    mounted,
    loading,
    refreshing,
    auto,
    setAuto,

    // datos
    items,
    total,

    // filtros
    filtros,
    setFiltros,

    // paginación
    PAGE_SIZE,
    page,
    setPage,
    hasMore,
    nextPage,
    prevPage,

    // detalle
    detail,
    openDetail,
    closeDetail,

    // combos
    empOpts,
    locOpts,

    // acciones
    reload,
  };
}

/* =============== Adaptador DTO → Movement =============== */
function adaptMovimiento(m: any): Movement {
  // Soporta varios contratos del backend
  // A) DTO “MovimientoResumen”
  if (m && m.via && m.fechas) {
    const viaOrigen =
      m.via?.origen?.nombre ?? (m.via?.origen?.numero != null ? `Vía ${m.via.origen.numero}` : undefined);
    const viaDestino =
      m.via?.destino?.nombre ??
      (m.via?.destino?.numero != null ? `Vía ${m.via.destino.numero}` : undefined);

    return {
      id: m.id,
      localidadNombre: m.localidad ?? undefined,
      empresaNombre: m.empresa ?? undefined,
      locomotora: safeStr(m.locomotora ?? m.locomotiveNumber),
      viaOrigen,
      viaDestino,
      tipoAccion: m.tipo ?? m.accion ?? undefined,
      prioridad: m.prioridad ?? undefined,
      estado: m.estado ?? undefined,
      fechaSolicitud: m.fechas?.solicitud ?? null,
      fechaInicio: m.fechas?.inicio ?? null,
      fechaFin: m.fechas?.fin ?? null,
      instrucciones: m.instrucciones ?? undefined,
      finalizado: Boolean(m.estado === "Concluido" || m.finalizado),
      posicionCabina: m.posiciones?.cabina,
      posicionChimenea: m.posiciones?.chimenea,
      direccionEmpuje: m.posiciones?.empuje,
      incidenteGlobal: m.flags?.incidenteGlobal ?? false,
      lavado: m.flags?.lavado ?? false,
      torno: m.flags?.torno ?? false,
    };
  }

  // B) Modelo crudo DB
  return {
    id: m.id,
    localidadId: m.localidadId ?? m.localidad?.id,
    localidadNombre: m.localidad?.nombre ?? m.localidadNombre,
    empresaId: m.empresaId ?? m.empresa?.id,
    empresaNombre: m.empresa?.nombre ?? m.empresaNombre,
    locomotora: safeStr(m.locomotora ?? m.locomotiveNumber),
    viaOrigen: toText(m.viaOrigen),
    viaDestino: toText(m.viaDestino),
    tipoAccion: m.tipoAccion ?? m.tipo ?? m.tipoMovimiento ?? undefined,
    prioridad: m.prioridad,
    estado: m.estado,
    fechaSolicitud: m.fechaSolicitud ?? null,
    fechaInicio: m.fechaInicio ?? null,
    fechaFin: m.fechaFin ?? null,
    instrucciones: m.instrucciones,
    finalizado: Boolean(m.finalizado || String(m.estado ?? "").toUpperCase() === "CONCLUIDO"),
    posicionCabina: m.posicionCabina,
    posicionChimenea: m.posicionChimenea,
    direccionEmpuje: m.direccionEmpuje,
    incidenteGlobal: !!m.incidenteGlobal,
    lavado: !!m.lavado,
    torno: !!m.torno,
  };
}

/* =============== Helpers =============== */
function toText(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return v?.nombre ?? v?.numero ?? v?.code ?? v?.id ?? JSON.stringify(v);
}
function safeStr(v: any): string | undefined {
  if (v == null) return undefined;
  try {
    return String(v);
  } catch {
    return undefined;
  }
}
