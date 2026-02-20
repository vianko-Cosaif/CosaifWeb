// src/app/Components/movimientos/MovimientosPanel.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Nav from "./Nav";
import Filtros from "./Filtros";
import Tabla from "./Tabla";
import { useMovimientos, Rol } from "./useMovimientos";

/* ================== HELPERS SESIÓN ================== */

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function getRoleFromSession(): Rol {
  const c = (getCookie("role") || "").trim().toUpperCase();
  if (c) return c as Rol;

  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (raw) {
      const u = JSON.parse(raw);
      const r = String(u?.rol || u?.role || "").toUpperCase();
      if (r) return r as Rol;
    }
  } catch {
    // silencioso
  }
  return "CLIENTE";
}

/* ================== PROPS ================== */

interface MovimientosPanelProps {
  rol?: Rol;
  token?: string;
  puedeCrear?: boolean;
  apiBase?: string;
  empresaIdUsuario?: number | null;
  intervaloAutoMs?: number;
}

/* ================== COMPONENTE ================== */

export default function MovimientosPanel(props: MovimientosPanelProps) {
  const { rol: rolProp, token: tokenProp, puedeCrear = false } = props;
  const router = useRouter();

  const [rol, setRol] = useState<Rol>(() => rolProp ?? getRoleFromSession());
  const [token, setToken] = useState<string | undefined>(() => tokenProp);

  const [userEmpresaId, setUserEmpresaId] = useState<number | null>(null);
  const [userLocalidadId, setUserLocalidadId] = useState<number | null>(null);

  /* ================== RESOLVER SESIÓN ================== */

  useEffect(() => {
    if (tokenProp) {
      setToken(tokenProp);
      return;
    }
    const t = getCookie("token");
    if (t) setToken(t);
  }, [tokenProp]);

  useEffect(() => {
    if (rolProp) {
      setRol(rolProp);
      return;
    }
    setRol(getRoleFromSession());
  }, [rolProp]);

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (raw) {
        const u = JSON.parse(raw);
        const empId = Number(u?.empresaId ?? u?.empresa?.id ?? NaN);
        if (Number.isFinite(empId)) setUserEmpresaId(empId);
      }
    } catch {
      // nada
    }

    const locIdCookie = Number(getCookie("locId") || NaN);
    if (Number.isFinite(locIdCookie)) setUserLocalidadId(locIdCookie);
  }, []);

  /* ================== DATOS (HOOK) ================== */

  const {
    filas,
    total,
    cargando,
    ambito,
    setAmbito,
    filtros,
    setFiltros,
    empresas,
    localidades,
    recargar,
    tab,
    setTab,
    badges,
    emptyText,
  } = useMovimientos(rol, token);

  const [movimientoSeleccionado, setMovimientoSeleccionado] =
    useState<number | null>(null);

  /* ================== PERMISOS POR ROL ================== */

  const puedeElegirEmpresa = useMemo(
    () =>
      ["ADMINISTRADOR", "COORDINADOR"].includes(
        String(rol || "").toUpperCase()
      ),
    [rol]
  );

  useEffect(() => {
    if (puedeElegirEmpresa) return;

    setFiltros((prev) => ({
      ...prev,
      empresaId:
        userEmpresaId != null ? userEmpresaId : prev.empresaId ?? undefined,
      localidadId:
        userLocalidadId != null
          ? userLocalidadId
          : prev.localidadId ?? undefined,
      pagina: 1,
    }));
  }, [puedeElegirEmpresa, userEmpresaId, userLocalidadId, setFiltros]);

  const listaEmpresas = useMemo(() => {
    if (puedeElegirEmpresa) return empresas;
    if (userEmpresaId != null) {
      const e = empresas.find((x) => x.id === userEmpresaId);
      return e ? [e] : empresas;
    }
    return empresas;
  }, [empresas, puedeElegirEmpresa, userEmpresaId]);

  const listaLocalidades = useMemo(() => {
    if (puedeElegirEmpresa) return localidades;
    if (userLocalidadId != null) {
      const l = localidades.find((x) => x.id === userLocalidadId);
      return l ? [l] : localidades;
    }
    return localidades;
  }, [localidades, puedeElegirEmpresa, userLocalidadId]);

  /* ================== HANDLERS ================== */

  const handleCambiarAmbito = useCallback(
    (nuevoAmbito: typeof ambito) => {
      setAmbito(nuevoAmbito);
      setFiltros((prev) => ({ ...prev, pagina: 1 }));
    },
    [setAmbito, setFiltros]
  );

  const handleBuscar = useCallback(
    (texto: string) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        busqueda: texto,
      }));
    },
    [setFiltros]
  );

  const handleCambiarEmpresaId = useCallback(
    (empresaId: number | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        empresaId: empresaId ?? undefined,
      }));
    },
    [setFiltros]
  );

  const handleCambiarLocalidadId = useCallback(
    (localidadId: number | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        localidadId: localidadId ?? undefined,
      }));
    },
    [setFiltros]
  );

  const handleCambiarRangoFechas = useCallback(
    (desde: string | null, hasta: string | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        desde: desde ?? undefined,
        hasta: hasta ?? undefined,
      }));
    },
    [setFiltros]
  );

  const handleCambiarTamPagina = useCallback(
    (tamPagina: number) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        tamPagina,
      }));
    },
    [setFiltros]
  );

  const handleLimpiarFiltros = useCallback(() => {
    setFiltros((prev) => ({
      ...prev,
      pagina: 1,
      empresaId: puedeElegirEmpresa
        ? undefined
        : prev.empresaId ?? undefined,
      localidadId: puedeElegirEmpresa
        ? undefined
        : prev.localidadId ?? undefined,
      desde: undefined,
      hasta: undefined,
    }));
  }, [setFiltros, puedeElegirEmpresa]);

  const handlePagina = useCallback(
    (pagina: number) => {
      setFiltros((prev) => ({
        ...prev,
        pagina,
      }));
    },
    [setFiltros]
  );

  const handleEditar = useCallback(
    (id: number) => {
      const BASE: Record<string, string> = {
        ADMINISTRADOR: "/administrador",
        COORDINADOR: "/coordinador",
        SUPERVISOR: "/supervisor",
        CLIENTE: "/cliente",
      };
      const base = BASE[String(rol).toUpperCase()] ?? "/cliente";
      router.push(`${base}/editar?id=${id}`);
    },
    [router, rol]
  );

  const handleToggleAuto = useCallback((_activo: boolean) => {
    // El auto-refresh ya lo maneja useMovimientos en "actuales"
  }, []);

  const handleNuevo = useCallback(() => {
    router.push("/movimientos/crear");
  }, [router]);

  /* ================== RENDER ================== */

  return (
    <section
      className="
        w-full 
        rounded-2xl sm:rounded-3xl 
        border border-slate-200/80 dark:border-slate-800/80 
        bg-white/95 dark:bg-slate-950/95 
        text-slate-900 dark:text-slate-100
        shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50
        overflow-hidden
        backdrop-blur-sm
        touch-manipulation
      "
    >
      <div className="flex flex-col gap-3 sm:gap-5 px-2 py-3 sm:px-5 sm:py-6 lg:px-7 lg:py-8 min-w-0">
        {/* Header con gradiente */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="flex items-center gap-3">
            {/* Icon container */}
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" x2="4" y1="22" y2="15" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                Movimientos
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                Gestión ferroviaria
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {tab}
                </span>
                {cargando && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                      sincronizando
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Stats mini */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{total}</span>
              <span className="text-slate-500 dark:text-slate-400">registro{total === 1 ? "" : "s"}</span>
            </div>
          </div>
        </header>

        {/* Gradient separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/40 dark:via-emerald-600/30 to-transparent" />

        {/* Card: Nav + Filtros */}
        <section
          className="
            space-y-3 
            rounded-xl sm:rounded-2xl 
            border border-slate-100 dark:border-slate-800/60 
            bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/60 dark:to-slate-950/60
            px-2 py-2 sm:px-4 sm:py-4 
            shadow-sm
          "
        >
          <Nav
            ambito={ambito}
            busqueda={filtros.busqueda}
            autoActualizacion={ambito === "actuales"}
            estaCargando={cargando}
            contadores={{
              actuales: badges.Actuales ?? 0,
              pasados: ambito === "pasados" ? total : 0,
            }}
            puedeCrear={puedeCrear}
            onCambiarAmbito={(nuevo) => {
              handleCambiarAmbito(nuevo);
              setTab(nuevo === "actuales" ? "Actuales" : "Pasados");
            }}
            onBuscar={handleBuscar}
            onToggleAuto={handleToggleAuto}
            onRefrescar={recargar}
            onNuevo={handleNuevo}
          />

          <Filtros
            filtros={{
              empresaId: filtros.empresaId,
              localidadId: filtros.localidadId,
              desde: filtros.desde ?? null,
              hasta: filtros.hasta ?? null,
              tamPagina: filtros.tamPagina,
            }}
            listaEmpresas={listaEmpresas}
            listaLocalidades={listaLocalidades}
            puedeElegirEmpresa={puedeElegirEmpresa}
            onCambiarEmpresaId={handleCambiarEmpresaId}
            onCambiarLocalidadId={handleCambiarLocalidadId}
            onCambiarRangoFechas={handleCambiarRangoFechas}
            onCambiarTamPagina={handleCambiarTamPagina}
            onLimpiarFiltros={handleLimpiarFiltros}
            deshabilitado={cargando}
          />
        </section>

        {/* Card: Tabla */}
        <section
          className="
            flex-1 
            rounded-xl sm:rounded-2xl 
            border border-slate-100 dark:border-slate-800/60 
            bg-white dark:bg-slate-950/80 
            px-1 py-1.5 sm:px-3 sm:py-3 lg:px-4 lg:py-4 
            flex flex-col
            overflow-hidden
            shadow-sm
          "
        >
          {filas.length === 0 && !cargando ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 sm:py-16 gap-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-600">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" x2="4" y1="22" y2="15" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {emptyText}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Ajusta los filtros o cambia de pestaña
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 min-h-0">
              <Tabla
                filas={filas}
                pagina={filtros.pagina}
                tamPagina={filtros.tamPagina}
                total={total}
                campoOrden={filtros.campoOrden}
                direccionOrden={filtros.direccionOrden}
                cargando={cargando}
                onPagina={handlePagina}
                onOrden={(campo, dir) =>
                  setFiltros((prev) => ({
                    ...prev,
                    pagina: 1,
                    campoOrden: campo,
                    direccionOrden: dir,
                  }))
                }
                onEditar={handleEditar}
              />
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
