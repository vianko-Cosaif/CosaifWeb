// src/app/Components/movimientos/MovimientosPanel.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Nav from "./Nav";
import Filtros from "./Filtros";
import Tabla from "./Tabla";
import Detalle from "./Detalle";
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
  rol?: Rol;      // si no viene, se toma de cookie/localStorage
  token?: string; // si no viene, se toma de cookie "token"
  puedeCrear?: boolean;

  apiBase?: string;
  empresaIdUsuario?: number | null;
  intervaloAutoMs?: number;
}

/* ================== COMPONENTE ================== */

export default function MovimientosPanel(props: MovimientosPanelProps) {
  const { rol: rolProp, token: tokenProp, puedeCrear = false } = props;

  // Rol/token efectivos
  const [rol, setRol] = useState<Rol>(() => rolProp ?? getRoleFromSession());
  const [token, setToken] = useState<string | undefined>(() => tokenProp);

  const [userEmpresaId, setUserEmpresaId] = useState<number | null>(null);
  const [userLocalidadId, setUserLocalidadId] = useState<number | null>(null);

  /* ================== RESOLVER SESIÓN ================== */

  // Resolver token desde cookie si no lo pasaron
  useEffect(() => {
    if (tokenProp) {
      setToken(tokenProp);
      return;
    }
    const t = getCookie("token");
    if (t) setToken(t);
  }, [tokenProp]);

  // Resolver rol desde sesión si no lo pasaron
  useEffect(() => {
    if (rolProp) {
      setRol(rolProp);
      return;
    }
    setRol(getRoleFromSession());
  }, [rolProp]);

  // Cargar empresa/localidad asignadas al usuario (CLIENTE / SUPERVISOR)
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

  const [detalleAbierto, setDetalleAbierto] = useState(false);
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

  // Forzar empresa/localidad para CLIENTE / SUPERVISOR
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

  // Listas de empresas/localidades vistas en filtros
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
      if (rol === "CLIENTE") {
        // Para CLIENTE, navega a pantalla de edición propia
        window.location.assign(`/cliente/editar?id=${id}`);
        return;
      }

      // Para otros roles sigues usando el drawer/modal
      setMovimientoSeleccionado(id);
      setDetalleAbierto(true);
    },
    [rol]
  );

  const handleCerrarDetalle = useCallback(() => {
    setDetalleAbierto(false);
    setMovimientoSeleccionado(null);
  }, []);

  const handleToggleAuto = useCallback((_activo: boolean) => {
    // El auto-refresh ya lo maneja useMovimientos en "actuales"
  }, []);

  const handleNuevo = useCallback(() => {
    window.location.assign("/movimientos/crear");
  }, []);

  /* ================== RENDER ================== */

  return (
    <section
      className="
        w-full 
        rounded-3xl 
        border border-slate-200 dark:border-slate-800 
        bg-white/95 dark:bg-slate-950/90 
        text-slate-900 dark:text-slate-100
        shadow-md sm:shadow-lg
        overflow-hidden
      "
    >
      {/* El max-w lo controla la página padre (cliente/movimientos) */}
      <div className="flex flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-7">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">
              Movimientos
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Gestión de movimientos ferroviarios · {tab}
            </p>
          </div>
        </header>

        {/* Card: Nav + Filtros */}
        <section
          className="
            space-y-3 
            rounded-2xl 
            border border-slate-100 dark:border-slate-800 
            bg-slate-50/90 dark:bg-slate-900/80 
            px-3 py-3 sm:px-4 sm:py-4 
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
            rounded-2xl 
            border border-slate-100 dark:border-slate-800 
            bg-slate-50/90 dark:bg-slate-900/90 
            px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4 
            flex flex-col
            overflow-hidden
          "
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            <span>
              {total} registro{total === 1 ? "" : "s"} · página{" "}
              {filtros.pagina}
            </span>
            {cargando && (
              <span className="animate-pulse text-slate-600 dark:text-slate-300">
                Actualizando…
              </span>
            )}
          </div>

          {filas.length === 0 && !cargando ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 px-2 text-center">
              {emptyText}
            </div>
          ) : (
            <div className="relative flex-1 min-h-0">
              {/* Nada de -mx ni contenedores con min-width: el ancho lo manda el viewport */}
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

        {/* Drawer / modal de detalle */}
        <Detalle
          abierto={detalleAbierto}
          movimientoId={movimientoSeleccionado}
          onCerrar={handleCerrarDetalle}
        />
      </div>
    </section>
  );
}

/* ================== SUBCOMPONENTES ================== */


