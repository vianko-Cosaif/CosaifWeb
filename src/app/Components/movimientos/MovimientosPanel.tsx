"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Filter,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
} from "lucide-react";

/* ===== Tipos ===== */
export type Movement = {
  id: number;
  locomotora: string;
  localidadId: number;
  localidadNombre?: string;
  localidadEstado?: string;
  viaOrigen: string;
  viaDestino: string;
  tipoAccion: string;
  prioridad: string;
  tipoMovimiento: string;
  clienteId: number | string | null;
  supervisorId: number | string | null;
  coordinadorId: number | string | null;
  operadorId: number | string | null;
  maquinistaId: number | string | null;
  empresaId: number;
  empresaNombre?: string;
  fechaSolicitud: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: string;
  instrucciones?: string;
  incidenteGlobal: boolean;
  finalizado: boolean;
  lavado: boolean;
  torno: boolean;
  posicionCabina?: string;
  posicionChimenea?: string;
  direccionEmpuje?: string;
  comentarioPostergacion?: string;
  nuevaFechaPostergacion?: string | null;
};

type Option = { id: number; nombre: string };

export interface MovimientosPanelProps {
  apiBase?: string;
  empresas?: Option[];
  localidades?: Option[];
  defaultEmpresaId?: number | null;
  defaultLocalidadId?: number | null;
  role?: string;
  allowCreate?: boolean;
}

/* ===== Utils ===== */
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("es-MX") : "—";
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("es-MX") : "—";
const todayISO = () => new Date().toISOString().slice(0, 10);
const clsx = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");
const toText = (v: any) =>
  v == null
    ? "—"
    : typeof v === "object"
    ? v?.nombre ?? v?.numero ?? v?.code ?? v?.id ?? JSON.stringify(v)
    : String(v);

const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
};

function getUserMeta() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function useVisibleInterval(cb: () => void, ms: number | null) {
  useEffect(() => {
    if (!ms) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") cb();
    }, ms);
    const onVis = () => {
      if (document.visibilityState === "visible") cb();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cb, ms]);
}

/* ===== Componente ===== */
export default function MovimientosPanel({
  apiBase = "/xapi",
  empresas = [],
  localidades = [],
  defaultEmpresaId = null,
  defaultLocalidadId = null,
  role = "",
  allowCreate = false,
}: MovimientosPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // rol / cookies
  const userMeta = useMemo(getUserMeta, []);
  const cookieRole = (getCookie("role") || (userMeta as any)?.rol || role || "CLIENTE").toString();
  const roleUp = cookieRole.toUpperCase();
  const isClient = roleUp === "CLIENTE";
  const token = getCookie("token");
  const cookieLocId = Number(getCookie("locId") || "") || null;

  // filtros (CLIENTE bloqueado en empresa + localidad)
  const [empId, setEmpId] = useState<number | null>(defaultEmpresaId ?? null);
  const [locId, setLocId] = useState<number | null>(defaultLocalidadId ?? cookieLocId ?? null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"Actuales" | "Pasados">("Actuales");

  // combos
  const [empOpts, setEmpOpts] = useState<Option[]>(empresas);
  const [locOpts, setLocOpts] = useState<Option[]>(localidades);
  const [combosReady, setCombosReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadCombos() {
      try {
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        if (!empresas.length) {
          const r = await fetch(`${apiBase}/empresas`, {
            cache: "no-store",
            credentials: "include",
            headers,
          });
          if (r.ok) {
            const data = await r.json();
            if (!ignore) setEmpOpts(data.map((x: any) => ({ id: x.id, nombre: x.nombre })));
          }
        }
        if (!localidades.length) {
          const r = await fetch(`${apiBase}/localidades`, {
            cache: "no-store",
            credentials: "include",
            headers,
          });
          if (r.ok) {
            const data = await r.json();
            if (!ignore) setLocOpts(data.map((x: any) => ({ id: x.id, nombre: x.nombre })));
          }
        }
      } catch {}
      if (!ignore) setCombosReady(true);
    }
    loadCombos();
    return () => {
      ignore = true;
    };
  }, [apiBase, empresas.length, localidades.length, token]);

  // derivar empresaId del CLIENTE
  useEffect(() => {
    if (!isClient || empId != null) return;
    try {
      const name = ((userMeta as any)?.empresa?.nombre || "").toLowerCase().trim();
      if (!name) return;

      const byOpts = empOpts.find((e) => e.nombre.toLowerCase().trim() === name);
      if (byOpts) { setEmpId(byOpts.id); return; }

      const raw = localStorage.getItem("cached_companies_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        const arr: Option[] = parsed?.data ?? [];
        const found = arr.find((e) => e.nombre.toLowerCase().trim() === name);
        if (found) { setEmpId(found.id); return; }
      }
    } catch {}
  }, [isClient, empId, empOpts, (userMeta as any)?.empresa?.nombre]);

  // paginación / datos
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);


  const  Filtro_Base = "http://38.90.13.1"



  const a = useState<booolean>(() => {
    if("Actuales"){
      
    }
  }


)
  
  // auto-refresh
  const [auto, setAuto] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mov:auto") !== "0";
  });
  useEffect(() => {
    try { localStorage.setItem("mov:auto", auto ? "1" : "0"); } catch {}
  }, [auto]);

  const reqSeq = useRef(0);
  const load = useCallback(
    async (showRefreshing = false) => {
      if (isClient && empId == null) return;

      const my = ++reqSeq.current;
      showRefreshing ? setRefreshing(true) : setLoading(true);
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        let url = "";
        const q = new URLSearchParams();
        if (from) q.append("fechaInicio", from);
        if (to) q.append("fechaFin", to);
        q.append("page", String(page));
        q.append("pageSize", String(PAGE_SIZE));
        if (tab === "Pasados") q.append("finalizado", "true");

        if (isClient) {
          url = `${apiBase}/movimientos/empresa/${empId}${locId != null ? `/localidad/${locId}` : ""}?${q.toString()}`;
        } else {
          if (empId != null) q.append("empresaId", String(empId));
          if (locId != null) q.append("localidadId", String(locId));
          url = `${apiBase}/movimientos?${q.toString()}`;
        }

        const r = await fetch(url, { cache: "no-store", credentials: "include", headers });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (my !== reqSeq.current) return;

        const raw = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        const rows: Movement[] = raw.map((m: any): Movement => {
          const estadoCalc = m.estado ?? m.status ?? (m.finalizado ? "CONCLUIDO" : "PENDIENTE");
          const finalizadoCalc = m.finalizado ?? (String(estadoCalc).toUpperCase() === "CONCLUIDO");
          return {
            id: m.id,
            locomotora: toText(m.locomotora ?? m.locomotiveNumber ?? m.loco ?? m.locomotoraNumero),
            localidadId: m.localidadId ?? m.localidad?.id ?? 0,
            localidadNombre: m.localidadNombre ?? m.localidad?.nombre ?? (typeof m.localidad === "string" ? m.localidad : undefined),
            localidadEstado: m.localidadEstado ?? m.localidad?.estado,
            viaOrigen: toText(m.viaOrigen),
            viaDestino: toText(m.viaDestino),
            tipoAccion: m.tipoAccion ?? m.accion ?? m.action ?? "—",
            prioridad: m.prioridad ?? m.priority ?? "MEDIA",
            tipoMovimiento: m.tipoMovimiento ?? m.movementType ?? "—",
            clienteId: m.clienteId ?? null,
            supervisorId: m.supervisorId ?? null,
            coordinadorId: m.coordinadorId ?? null,
            operadorId: m.operadorId ?? null,
            maquinistaId: m.maquinistaId ?? null,
            empresaId: m.empresaId,
            empresaNombre: m.empresaNombre ?? m.empresa?.nombre ?? (userMeta as any)?.empresa?.nombre ?? undefined,
            fechaSolicitud: m.fechaSolicitud ?? m.createdAt ?? null,
            fechaInicio: m.fechaInicio ?? null,
            fechaFin: m.fechaFin ?? null,
            estado: estadoCalc,
            instrucciones: m.instrucciones,
            incidenteGlobal: !!m.incidenteGlobal,
            finalizado: !!finalizadoCalc,
            lavado: !!m.lavado,
            torno: !!m.torno,
            posicionCabina: m.posicionCabina,
            posicionChimenea: m.posicionChimenea,
            direccionEmpuje: m.direccionEmpuje,
            comentarioPostergacion: m.comentarioPostergacion,
            nuevaFechaPostergacion: m.nuevaFechaPostergacion ?? null,
          };
        });

        const securedRows = isClient
          ? rows.filter((r) => r.empresaId === empId && (locId == null || r.localidadId === locId))
          : rows;

        const finalRows = tab === "Actuales" ? securedRows.filter((r) => !r.finalizado) : securedRows.filter((r) => r.finalizado);

        setItems(finalRows);
        setTotal(Number((data as any)?.total ?? finalRows.length));
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, empId, locId, from, to, page, tab, isClient, token, (userMeta as any)?.empresa?.nombre]
  );

  useEffect(() => { load(false); }, [load]);
  useVisibleInterval(() => auto && load(false), auto ? 20000 : null);

  // búsqueda local
  const filtered = useMemo(() => {
    const qx = (q || "").trim().toLowerCase();
    if (!qx) return items;
    const hay = (s: any) => String(s ?? "").toLowerCase().includes(qx);
    return items.filter((m) =>
      hay(m.id) || hay(m.locomotora) || hay(m.empresaNombre) || hay(m.localidadNombre) ||
      hay(m.viaOrigen) || hay(m.viaDestino) || hay(m.estado) || hay(m.tipoAccion) || hay(m.tipoMovimiento)
    );
  }, [items, q]);

  // detalle (bloqueado para CLIENTE)
  const [detail, setDetail] = useState<Movement | null>(null);
  const openDetail = (m: Movement) => { if (isClient) return; setDetail(m); };

  // badges / resets
  const tabBadges = useMemo(() => ({ Actuales: filtered.filter((x) => !x.finalizado).length }), [filtered]);
  useEffect(() => { setPage(1); }, [empId, locId, from, to, tab]);

  const lockedEmpresa = isClient;
  const lockedLocalidad = isClient;

  const showClear =
    !!from || !!to || !!q ||
    (!lockedLocalidad && locId != null) ||
    (!lockedEmpresa && empId != null);

  /* ===== Render ===== */
  return (
    <section className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 space-y-3">
      {/* Toolbar */}
      <div className="pane sticky z-10 top-[max(0px,env(safe-area-inset-top))] flex flex-wrap items-center gap-2 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/70">
        <div className="inline-flex rounded-lg border overflow-hidden">
          {(["Actuales", "Pasados"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "px-3 py-2 text-sm md:text-[13px] min-h-10 transition-colors",
                tab === t ? "bg-sky-600 text-white" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
              aria-pressed={tab === t}
            >
              {t}
              {t === "Actuales" && tabBadges.Actuales > 0 ? (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{tabBadges.Actuales}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56 md:w-72">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="input pl-8 w-full text-sm md:text-base min-h-10"
              placeholder="Buscar…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar movimientos"
            />
          </div>

          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            className={clsx("rounded-md border px-3 py-2 text-sm md:text-[13px] min-h-10", auto ? "border-emerald-300 text-emerald-700 dark:text-emerald-300" : "")}
            aria-pressed={auto}
            title="Auto-actualizar"
          >
            {auto ? "⏸️ Auto" : "▶️ Auto"}
          </button>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm md:text-[13px] min-h-10 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            aria-busy={refreshing}
            title="Refrescar"
          >
            <RefreshCw className="h-4 w-4" />
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>

          {allowCreate &&  (
            <Link
              href="/movimientos/crear"
              className="btn-primary !w-auto min-h-10 text-sm md:text-[13px] inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo movimiento
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="pane">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          {showClear && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm md:text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                if (!lockedEmpresa) setEmpId(null);
                if (!lockedLocalidad) setLocId(null);
                setFrom(""); setTo(""); setQ(""); setPage(1);
              }}
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Empresa */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Empresa</label>
            {lockedEmpresa ? (
              <input
                className="input min-h-10"
                value={empOpts.find((o) => o.id === empId)?.nombre ?? (userMeta as any)?.empresa?.nombre ?? "Mi empresa"}
                disabled
              />
            ) : (
              <select
                className="input min-h-10"
                value={empId ?? ""}
                onChange={(e) => setEmpId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todas</option>
                {empOpts.map((o) => (<option key={o.id} value={o.id}>{o.nombre}</option>))}
              </select>
            )}
          </div>

          {/* Localidad */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs text-slate-500">Localidad</label>
            {lockedLocalidad ? (
              <input className="input min-h-10" value={locOpts.find((o) => o.id === locId)?.nombre ?? "Mi localidad"} disabled />
            ) : (
              <select
                className="input min-h-10"
                value={locId ?? ""}
                onChange={(e) => setLocId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todas</option>
                {locOpts.map((o) => (<option key={o.id} value={o.id}>{o.nombre}</option>))}
              </select>
            )}
          </div>

          {/* Desde */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Desde</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="date" className="input pl-8 min-h-10" max={to || undefined} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>

          {/* Hasta */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">Hasta</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="date" className="input pl-8 min-h-10" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} max={todayISO()} />
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas móvil */}
      <div className="grid gap-3 md:hidden">
        {!mounted || loading ? (
          <CardSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <EmptyBox text="Sin resultados">
            {allowCreate && !isClient && (
              <Link href="/movimientos/crear" className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <Plus className="h-4 w-4" /> Crear movimiento
              </Link>
            )}
          </EmptyBox>
        ) : (
          filtered.map((m) => (
            <article key={m.id} className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-70">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-base">#{m.id} · {m.localidadNombre ?? "—"}</h3>
                <Badge
                  tone={
                    m.estado?.toUpperCase() === "CONCLUIDO" ? "ok" :
                    m.estado?.toUpperCase() === "DETENIDO" ? "error" :
                    m.estado?.toUpperCase() === "EN_PROCESO" ? "warn" : "muted"
                  }
                >
                  {m.estado || (m.finalizado ? "CONCLUIDO" : "PENDIENTE")}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <InfoItem k="Empresa" v={m.empresaNombre ?? "—"} />
                <InfoItem k="Locomotora" v={m.locomotora} />
                <InfoItem k="Acción" v={m.tipoAccion} />
                <InfoItem k="Tipo" v={m.tipoMovimiento} />
                <InfoItem k="Vía Origen" v={m.viaOrigen} />
                <InfoItem k="Vía Destino" v={m.viaDestino} />
                <InfoItem k="Solicitud" v={fmtDate(m.fechaSolicitud)} />
                <InfoItem k="Inicio" v={fmtDateTime(m.fechaInicio)} />
                <InfoItem k="Fin" v={fmtDateTime(m.fechaFin)} />
              </dl>

              {!isClient && (
                <div className="mt-3 flex items-center justify-between">
                  <Badge tone={m.prioridad === "ALTA" ? "warn" : m.prioridad === "BAJA" ? "muted" : "ok"}>
                    {m.prioridad || "—"}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => openDetail(m)}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Detalle
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-[13px] md:text-sm table-auto">
          <colgroup>
            <col className="w-16" />
            <col className="hidden lg:table-column w-[220px]" />
            <col className="hidden lg:table-column w-[220px]" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="hidden xl:table-column w-[260px]" />
            <col className="hidden xl:table-column w-[200px]" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="hidden 2xl:table-column w-32" />
            <col className="hidden lg:table-column w-32" />
            <col className="hidden lg:table-column w-32" />
            <col className="w-24" />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr className="text-left">
              <Th>ID</Th>
              <Th className="hidden lg:table-cell">Empresa</Th>
              <Th className="hidden lg:table-cell">Localidad</Th>
              <Th>Locomotora</Th>
              <Th>Vía Origen</Th>
              <Th>Vía Destino</Th>
              <Th className="hidden xl:table-cell">Acción</Th>
              <Th className="hidden xl:table-cell">Tipo mov.</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              <Th className="hidden 2xl:table-cell">Solicitud</Th>
              <Th className="hidden lg:table-cell">Inicio</Th>
              <Th className="hidden lg:table-cell">Fin</Th>
              {!isClient && <Th className="text-right">&nbsp;</Th>}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800">
            {!mounted || loading ? (
              <RowLoading />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={isClient ? 13 : 14} className="p-6 text-center text-slate-500 dark:text-slate-400">
                  Sin resultados
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                  <Td>#{m.id}</Td>
                  <Td className="hidden lg:table-cell max-w-[220px] truncate">{m.empresaNombre ?? "—"}</Td>
                  <Td className="hidden lg:table-cell max-w-[220px] truncate">{m.localidadNombre ?? "—"}</Td>
                  <Td>{m.locomotora ?? "—"}</Td>
                  <Td>{m.viaOrigen ?? "—"}</Td>
                  <Td>{m.viaDestino ?? "—"}</Td>
                  <Td className="hidden xl:table-cell max-w-[260px] truncate">{m.tipoAccion}</Td>
                  <Td className="hidden xl:table-cell max-w-[200px] truncate">{m.tipoMovimiento}</Td>
                  <Td>
                    <Badge tone={m.prioridad === "ALTA" ? "warn" : m.prioridad === "BAJA" ? "muted" : "ok"}>
                      {m.prioridad || "—"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        m.estado?.toUpperCase() === "CONCLUIDO" ? "ok" :
                        m.estado?.toUpperCase() === "DETENIDO" ? "error" :
                        m.estado?.toUpperCase() === "EN_PROCESO" ? "warn" : "muted"
                      }
                    >
                      {m.estado || (m.finalizado ? "CONCLUIDO" : "PENDIENTE")}
                    </Badge>
                  </Td>
                  <Td className="hidden 2xl:table-cell whitespace-nowrap">{fmtDate(m.fechaSolicitud)}</Td>
                  <Td className="hidden lg:table-cell whitespace-nowrap">{fmtDateTime(m.fechaInicio)}</Td>
                  <Td className="hidden lg:table-cell whitespace-nowrap">{fmtDateTime(m.fechaFin)}</Td>
                  {!isClient && (
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(m)}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Detalle
                      </button>
                    </Td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} / {total} items
        </div>
        <div className="inline-flex flex-wrap items-center gap-2 self-end sm:self-auto">
          <button
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-60"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Anterior"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm tabular-nums">Página {page}</div>
          <button
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-60"
            disabled={filtered.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
            title="Siguiente"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal detalle (NO para CLIENTE) */}
      {!isClient && detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-2 sm:p-4 md:p-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl max-h-[85svh] overflow-y-auto rounded-2xl border bg-white p-3 sm:p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Movimiento #{detail.id}</h3>
              <button className="rounded-md border px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setDetail(null)} aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Empresa" value={detail.empresaNombre ?? detail.empresaId} />
              <Info label="Localidad" value={detail.localidadNombre ?? "—"} />
              <Info label="Estado" value={detail.estado ?? (detail.finalizado ? "CONCLUIDO" : "PENDIENTE")} />
              <Info label="Prioridad" value={detail.prioridad} />
              <Info label="Locomotora" value={detail.locomotora} />
              <Info label="Acción" value={detail.tipoAccion} />
              <Info label="Tipo movimiento" value={detail.tipoMovimiento} />
              <Info label="Vía Origen" value={detail.viaOrigen} />
              <Info label="Vía Destino" value={detail.viaDestino} />
              <Info label="Solicitud" value={fmtDate(detail.fechaSolicitud)} />
              <Info label="Inicio" value={fmtDateTime(detail.fechaInicio)} />
              <Info label="Fin" value={fmtDateTime(detail.fechaFin)} />
              <Info label="Incidente global" value={detail.incidenteGlobal ? "Sí" : "No"} />
              <Info label="Lavado" value={detail.lavado ? "Sí" : "No"} />
              <Info label="Torno" value={detail.torno ? "Sí" : "No"} />
              <Info label="Posición cabina" value={detail.posicionCabina ?? "—"} />
              <Info label="Posición chimenea" value={detail.posicionChimenea ?? "—"} />
              <Info label="Dirección empuje" value={detail.direccionEmpuje ?? "—"} />
              <Info label="Cliente" value={detail.clienteId ?? "—"} />
              <Info label="Supervisor" value={detail.supervisorId ?? "—"} />
              <Info label="Coordinador" value={detail.coordinadorId ?? "—"} />
              <Info label="Operador" value={detail.operadorId ?? "—"} />
              <Info label="Maquinista" value={detail.maquinistaId ?? "—"} />
              <Info label="Nueva fecha" value={fmtDateTime(detail.nuevaFechaPostergacion)} />
            </div>

            {detail.instrucciones ? (
              <div className="mt-4 rounded-lg border-l-4 border-sky-400 bg-slate-50 p-3 text-sm dark:border-sky-600 dark:bg-slate-800">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Instrucciones</div>
                <p className="text-slate-700 dark:text-slate-200">{detail.instrucciones}</p>
              </div>
            ) : null}

            {detail.comentarioPostergacion ? (
              <div className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:border-amber-600 dark:bg-amber-900/20">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">Comentario de postergación</div>
                <p className="text-amber-900 dark:text-amber-100">{detail.comentarioPostergacion}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* FAB móvil para crear */}
      {allowCreate && !isClient && (
        <Link
          href="/movimientos/crear"
          className="md:hidden fixed bottom-5 right-5 inline-flex items-center justify-center rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 h-12 w-12"
          aria-label="Crear movimiento"
          title="Crear movimiento"
        >
          <Plus className="h-5 w-5" />
        </Link>
      )}
    </section>
  );
}

/* ===== Subcomponentes ===== */
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={clsx("px-3 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300", className)}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={clsx("px-3 py-2 align-middle", className)}>{children}</td>;
}
function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "error" | "muted";
}) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
    muted: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  } as const;
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-medium", map[tone])}>
      {children}
    </span>
  );
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
function InfoItem({ k, v, children }: { k: string; v?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{k}</div>
      <div className="font-medium text-slate-900 dark:text-slate-100">{v ?? children}</div>
    </div>
  );
}
function RowLoading() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 14 }).map((__, j) => (
            <td key={j} className="p-2">
              <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </>
  );
}
function EmptyBox({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      <div>{text}</div>
      {children}
    </div>
  );
}
