/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IncidentesTable from "./IncidentesTable";
import SmartIncidentBlocker from "./SmartIncidentBlocker";
import type { IncidenteRow, Meta, Role } from "./types";
import { AlertTriangle, BriefcaseBusiness, MapPin, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/passthrough";
const INCIDENTES = `${API_BASE}/incidentes`;

type DropdownOption = { id: number; nombre: string };

function pretty(obj: any) {
  try { return typeof obj === "string" ? obj : JSON.stringify(obj, null, 2); }
  catch { return String(obj); }
}

const detailCache = new Map<number, any>();
async function fetchIncidenteDetailsBulk(ids: number[], _token?: string, maxConcurrency = 4) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  const out: Record<number, any> = {};
  const pending: number[] = [];

  for (const id of uniq) {
    if (detailCache.has(id)) out[id] = detailCache.get(id);
    else pending.push(id);
  }
  if (!pending.length) return out;

  for (let i = 0; i < pending.length; i += maxConcurrency) {
    const chunk = pending.slice(i, i + maxConcurrency);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const r = await fetch(`${INCIDENTES}/${id}`); // cookie HttpOnly via proxy
          if (!r.ok) return;
          const j = await r.json();
          const data = j?.data ?? j;
          detailCache.set(id, data);
          out[id] = data;
        } catch {}
      })
    );
  }
  return out;
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString("es-ES"); }
  catch { return "Fecha inválida"; }
}

export default function IncidenteController() {
  type Tab = "Actuales" | "Pasados";
  const [role, setRole] = useState<Role>("CLIENTE");
  const tabs: Tab[] = role === "CLIENTE" || role === "SUPERVISOR" ? ["Actuales"] : ["Actuales", "Pasados"];
  const [tab, setTab] = useState<Tab>("Actuales");

  const [empOpts, setEmpOpts] = useState<DropdownOption[]>([]);
  const [locOpts, setLocOpts] = useState<DropdownOption[]>([]);
  const [empId, setEmpId] = useState<number | null>(null);
  const [locId, setLocId] = useState<number | null>(null);

  const [data, setData] = useState<IncidenteRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [blockerVisible, setBlockerVisible] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Mantengo tu variable, pero ya no dependemos de ella para auth:
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // carga user de localStorage
  useEffect(() => {
    try {
      const str = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (!str) return;
      const user = JSON.parse(str);
      const r = (user.rol as Role) || "CLIENTE";
      setRole(r);
      if (r === "CLIENTE" || r === "SUPERVISOR") {
        setEmpId(user.empresaId ?? null);
        setLocId(user.localidadId ?? null);
      }
    } catch {}
  }, []);

useEffect(() => {
  if (role === "CLIENTE") return;
  (async () => {
    try {
      const [eRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/empresas`),
        fetch(`${API_BASE}/localidades`),
      ]);
      const [eJson, lJson] = [await eRes.json(), await lRes.json()];
      const eOpts = Array.isArray(eJson) ? eJson.map((e: any) => ({ id: e.id, nombre: e.nombre })) : [];
      const lOpts = Array.isArray(lJson) ? lJson.map((l: any) => ({ id: l.id, nombre: l.nombre })) : [];
      setEmpOpts(eOpts);
      setLocOpts(lOpts);

      // si viene empId y no está en la lista, consulto esa empresa
      if (empId != null && !eOpts.some(o => o.id === empId)) {
        const r = await fetch(`${API_BASE}/empresas/${empId}`);
        if (r.ok) {
          const j = await r.json();
          const ent = j?.data ?? j;
          if (ent?.id) setEmpOpts(prev => [...prev, { id: ent.id, nombre: ent.nombre ?? `Empresa #${ent.id}` }]);
        }
      }
    } catch {}
  })();
}, [role, empId]);

  const buildUrl = useCallback(
    (page = 1) => {
      const estadoParam = role === "CLIENTE" || tab === "Actuales" ? "ABIERTO" : "PASADOS";
      const u = new URL(INCIDENTES, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      u.searchParams.set("page", String(page));
      u.searchParams.set("pageSize", "20");
      u.searchParams.set("estado", estadoParam);
      if (empId != null) u.searchParams.set("empresaId", String(empId));
      if (locId != null) u.searchParams.set("localidadId", String(locId));
      return u.toString();
    },
    [role, tab, empId, locId]
  );

  const fetchData = useCallback(
    async (page = 1) => {
      try {
        setError(null);
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        const url = buildUrl(page);
        const res = await fetch(url, { signal: ctrl.signal }); // auth via cookie en proxy
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
        const json = JSON.parse(text);
        if (!json.success || !Array.isArray(json.data)) throw new Error(json.error || "Formato inesperado");

        const ids = json.data.map((x: any) => Number(x.id)).filter(Boolean);
        const detailMap = await fetchIncidenteDetailsBulk(ids, token ?? undefined);

        const displayMap: Record<string, string> = { ABIERTO: "Activo", CERRADO: "Cerrado", RESUELTO: "Resuelto" };
        const enriched: IncidenteRow[] = json.data.map((inc: any) => {
          const det = detailMap[inc.id] || {};
          const mov = det.movimiento || inc.movimiento || {};
          return {
            id: inc.id,
            empresa:   mov?.empresa?.nombre ?? inc?.movimiento?.empresa?.nombre,
            locomotora:mov?.locomotiveNumber ?? inc?.movimiento?.locomotiveNumber,
            origen:    mov?.viaOrigen?.nombre ?? inc?.movimiento?.viaOrigen?.nombre,
            destino:   mov?.viaDestino?.nombre ?? inc?.movimiento?.viaDestino?.nombre,
            descripcion: det.descripcion ?? inc.descripcion,
            fecha: inc.fechaInicio ? formatDate(inc.fechaInicio) : "—",
            estatus: displayMap[inc.estado] || "Desconocido",
            estadoRaw: inc.estado,
            usuario: det?.usuario?.nombre ?? inc?.usuario?.nombre,
            _original: { ...inc, _detalle: det },
          };
        });

        const filtered =
          tab === "Actuales"
            ? enriched.filter((x) => x.estadoRaw === "ABIERTO")
            : enriched.filter((x) => x.estadoRaw === "CERRADO" || x.estadoRaw === "RESUELTO");

        setData(filtered);
        setMeta({
          page: json.meta.page,
          totalPages: json.meta.totalPages,
          total: json.meta.total,
          pageSize: json.meta.pageSize,
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e.message);
          setData([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        abortRef.current = null;
      }
    },
    [buildUrl, tab, token]
  );

  useEffect(() => {
    if (role === "CLIENTE" && (empId == null || locId == null)) return;
    fetchData(1);
  }, [role, empId, locId, tab, fetchData]);

  const onPageChange = (p: number) => { setRefreshing(true); fetchData(p); };
  const onRefresh    = () => { setRefreshing(true); fetchData(meta.page); };

  return (
    <div className="min-h-[80vh] bg-slate-50">
      {/* info */}
      <div className="border-b bg-white px-4 py-3 text-sm font-semibold text-slate-600">
        {role === "CLIENTE" ? "Cliente" : "Admin"}
        {data.length > 0 && ` • ${meta.total ?? data.length} incidentes ${tab.toLowerCase()}`}
        {(empId || locId) && " • Filtros activos"}
        {data.length === 0 && !loading && " • Sin datos"}
      </div>

      {/* tabs */}
      <div className="flex gap-2 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold shadow-sm " +
              (tab === t ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* filtros */}
      <div className="flex items-end gap-3 border-b bg-white p-4">
        <div className="flex-1">
          <div className="mb-1 text-xs font-extrabold text-slate-600">Empresa</div>
          <button
            disabled={role === "CLIENTE"}
            onClick={async () => {
              if (role === "CLIENTE") return;
              const id = prompt(`ID de empresa o vacío para todas\n${empOpts.map((o) => `${o.id} - ${o.nombre}`).join("\n")}`);
              setEmpId(id ? Number(id) : null);
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <BriefcaseBusiness className="h-4 w-4 text-emerald-700" />
            <span className="truncate">
              {empId ? empOpts.find((o) => o.id === empId)?.nombre || "—" : "Todas"}
            </span>
          </button>
        </div>

        <div className="flex-1">
          <div className="mb-1 text-xs font-extrabold text-slate-600">Localidad</div>
          <button
            disabled={role === "CLIENTE"}
            onClick={async () => {
              if (role === "CLIENTE") return;
              const id = prompt(`ID de localidad o vacío para todas\n${locOpts.map((o) => `${o.id} - ${o.nombre}`).join("\n")}`);
              setLocId(id ? Number(id) : null);
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <MapPin className="h-4 w-4 text-emerald-700" />
            <span className="truncate">
              {locId ? locOpts.find((o) => o.id === locId)?.nombre || "—" : "Todas"}
            </span>
          </button>
        </div>

        {role !== "CLIENTE" && (empId || locId) && (
          <button
            onClick={() => { setEmpId(null); setLocId(null); }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-500 px-3 py-2 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* tabla */}
      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500" />
          <div className="text-lg font-extrabold text-rose-600">Error de conectividad</div>
          <div className="max-w-xl text-slate-600">{pretty(error)}</div>
          <button
            onClick={() => fetchData(meta.page)}
            className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <IncidentesTable
            data={data}
            loading={loading}
            meta={meta}
            onRowPress={(x) => { setSelected(x._original); setBlockerVisible(true); }}
            onPageChange={onPageChange}
            onRefresh={onRefresh}
            refreshing={refreshing}
            emptyStateText={tab === "Actuales" ? "Sin incidentes activos por el momento" : "Sin incidentes pasados registrados"}
          />

          {blockerVisible && selected && (
            <SmartIncidentBlocker
              incident={selected}
              operatorComment={selected.operadorComentario}
              onResolve={async (comments) => {
                setBlockerVisible(false);
                const url = `${INCIDENTES}/${selected.id}`;
                await fetch(url, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ estado: "RESUELTO", comentario: comments }),
                });
                fetchData(meta.page);
              }}
              onContinue={() => setBlockerVisible(false)}
              onSkip={async () => {
                setBlockerVisible(false);
                const url = `${INCIDENTES}/${selected.id}/cerrar`;
                await fetch(url, { method: "POST" });
                fetchData(meta.page);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
