// src/app/Components/movimientos/MovimientosPanel.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import Nav from "./Nav";
import Filtros from "./Filtros";
import Tabla from "./Tabla";
import { useMovimientos, type FechaCampo, type Rol, type Movement } from "./useMovimientos";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { DataEmptyState, KpiCard, ModuleHeader } from "@/app/Components/ui";
import { canViewMovementDuration } from "@/features/movimientos/table";
import { getRoleCapabilities } from "@/lib/accessControl";

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

function formatPanelDate(value?: string | null) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

function formatPanelDuration(minutes?: number | null) {
  if (!Number.isFinite(Number(minutes))) return "—";
  const safe = Math.max(0, Math.round(Number(minutes)));
  if (safe < 60) return `${safe} min`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const FECHA_CAMPOS_MOVIMIENTO = ["solicitud", "inicio", "fin", "creacion"] as const satisfies readonly FechaCampo[];

function isFechaCampoMovimiento(value: string | null): value is FechaCampo {
  return FECHA_CAMPOS_MOVIMIENTO.includes(value as FechaCampo);
}

function buildExecutionSummary(rows: Movement[]) {
  const starts = rows
    .map((row) => row.fechaInicio)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const ends = rows
    .map((row) => row.fechaFin)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const durations = rows
    .map((row) => durationMinutes(row.fechaInicio, row.fechaFin))
    .filter((value): value is number => typeof value === "number");
  const avg = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;

  return {
    firstStart: starts[0] ?? null,
    lastEnd: ends[ends.length - 1] ?? null,
    resolved: durations.length,
    avg,
  };
}

/* ================== PROPS ================== */

interface MovimientosPanelProps {
  rol?: Rol;
  token?: string;
  puedeCrear?: boolean;
  apiBase?: string;
  empresaIdUsuario?: number | null;
  localidadIdUsuario?: number | null;
  bloquearLocalidad?: boolean;
  intervaloAutoMs?: number;
}

/* ================== COMPONENTE ================== */

export default function MovimientosPanel(props: MovimientosPanelProps) {
  const {
    rol: rolProp,
    token: tokenProp,
    puedeCrear = false,
    apiBase,
    empresaIdUsuario,
    localidadIdUsuario,
    bloquearLocalidad = false,
    intervaloAutoMs,
  } = props;
  const router = useRouter();

  const [rol, setRol] = useState<Rol>(() => rolProp ?? getRoleFromSession());
  const [token, setToken] = useState<string | undefined>(() => tokenProp);

  const [userEmpresaId, setUserEmpresaId] = useState<number | null>(
    () => empresaIdUsuario ?? null
  );
  const [userLocalidadId, setUserLocalidadId] = useState<number | null>(
    () => localidadIdUsuario ?? null
  );
  const rolNormalizado = String(rol || "").toUpperCase();
  const roleCapabilities = useMemo(() => getRoleCapabilities(rolNormalizado), [rolNormalizado]);
  const puedeVerDuracionMovimiento = canViewMovementDuration(rolNormalizado);

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
    if (empresaIdUsuario != null && Number.isFinite(empresaIdUsuario)) {
      setUserEmpresaId(empresaIdUsuario);
    }
  }, [empresaIdUsuario]);

  useEffect(() => {
    if (localidadIdUsuario != null && Number.isFinite(localidadIdUsuario)) {
      setUserLocalidadId(localidadIdUsuario);
    }
  }, [localidadIdUsuario]);

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (raw) {
        const u = JSON.parse(raw);
        if (userEmpresaId == null) {
          const empId = Number(u?.empresaId ?? u?.empresa?.id ?? NaN);
          if (Number.isFinite(empId)) setUserEmpresaId(empId);
        }
        if (userLocalidadId == null) {
          const locId = Number(u?.localidadId ?? u?.localidad?.id ?? NaN);
          if (Number.isFinite(locId)) setUserLocalidadId(locId);
        }
      }
    } catch {
      // nada
    }

    if (userLocalidadId == null) {
      const locIdCookie = Number(
        getCookie("locId") || getCookie("localidadId") || NaN
      );
      if (Number.isFinite(locIdCookie)) setUserLocalidadId(locIdCookie);
    }
  }, [userEmpresaId, userLocalidadId]);

  /* ================== DATOS (HOOK) ================== */

  const {
    filas,
    total,
    totalEstimado,
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
  } = useMovimientos({
    rol,
    token,
    apiBase,
    autoRefreshMs: intervaloAutoMs,
    initialEmpresaId: roleCapabilities.canViewAllCompanies ? null : userEmpresaId,
    initialLocalidadId: roleCapabilities.canSwitchLocalidad ? null : userLocalidadId,
  });

  /* ================== PERMISOS POR ROL ================== */

  const puedeElegirLocalidad = roleCapabilities.canSwitchLocalidad && !bloquearLocalidad;
  const puedeVerTodasEmpresas = roleCapabilities.canViewAllCompanies;

  useEffect(() => {
    if (roleCapabilities.canViewAllCompanies && roleCapabilities.canSwitchLocalidad) return;

    setFiltros((prev) => ({
      ...prev,
      empresaId:
        !roleCapabilities.canViewAllCompanies && userEmpresaId != null
          ? userEmpresaId
          : prev.empresaId ?? undefined,
      localidadId:
        !roleCapabilities.canSwitchLocalidad && userLocalidadId != null
          ? userLocalidadId
          : prev.localidadId ?? undefined,
      pagina: 1,
    }));
  }, [roleCapabilities.canSwitchLocalidad, roleCapabilities.canViewAllCompanies, userEmpresaId, userLocalidadId, setFiltros]);

  const listaEmpresas = useMemo(() => {
    if (puedeVerTodasEmpresas) return empresas;
    if (userEmpresaId != null) {
      const e = empresas.find((x) => x.id === userEmpresaId);
      return e ? [e] : empresas;
    }
    return empresas;
  }, [empresas, puedeVerTodasEmpresas, userEmpresaId]);

  const listaLocalidades = useMemo(() => {
    if (puedeElegirLocalidad) return localidades;
    if (userLocalidadId != null) {
      const l = localidades.find((x) => x.id === userLocalidadId);
      return l ? [l] : localidades;
    }
    return localidades;
  }, [localidades, puedeElegirLocalidad, userLocalidadId]);

  const resumenEjecucion = useMemo(() => buildExecutionSummary(filas), [filas]);
  const ordenActual = useMemo(() => {
    const labelMap: Record<string, string> = {
      id: "ID",
      locomotora: "Locomotora",
      solicitud: "Solicitud",
      inicio: "Inicio real",
      fin: "Fin real",
      estado: "Estado",
      prioridad: "Prioridad",
      tipo: "Tipo",
      localidad: "Localidad",
      empresa: "Empresa",
    };
    return `${labelMap[filtros.campoOrden] ?? filtros.campoOrden} ${filtros.direccionOrden === "asc" ? "ascendente" : "descendente"}`;
  }, [filtros.campoOrden, filtros.direccionOrden]);

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
      if (!puedeElegirLocalidad) return;
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        localidadId: localidadId ?? undefined,
      }));
    },
    [puedeElegirLocalidad, setFiltros]
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

  const handleCambiarEstado = useCallback(
    (estado: string | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        estado: estado ?? undefined,
      }));
    },
    [setFiltros]
  );

  const handleCambiarPrioridad = useCallback(
    (prioridad: string | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        prioridad: prioridad ?? undefined,
      }));
    },
    [setFiltros]
  );

  const handleCambiarLocomotiveNumber = useCallback(
    (value: string | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        locomotiveNumber: value ?? undefined,
      }));
    },
    [setFiltros]
  );

  const handleCambiarFechaCampo = useCallback(
    (value: string | null) => {
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        fechaCampo: isFechaCampoMovimiento(value) ? value : undefined,
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
      empresaId: roleCapabilities.canViewAllCompanies
        ? undefined
        : userEmpresaId ?? prev.empresaId ?? undefined,
      localidadId: roleCapabilities.canSwitchLocalidad
        ? undefined
        : userLocalidadId ?? prev.localidadId ?? undefined,
      desde: undefined,
      hasta: undefined,
      estado: undefined,
      prioridad: undefined,
      locomotiveNumber: undefined,
      fechaCampo: "solicitud",
    }));
  }, [setFiltros, roleCapabilities.canSwitchLocalidad, roleCapabilities.canViewAllCompanies, userEmpresaId, userLocalidadId]);

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

  const handleToggleAuto = useCallback(() => {
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
        <ModuleHeader
          icon={Flag}
          title="Movimientos"
          subtitle="Gestión ferroviaria"
          badge={tab}
          loading={cargando}
          actions={
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{total}</span>
              <span className="text-slate-500 dark:text-slate-400">registro{total === 1 ? "" : "s"}</span>
            </div>
          }
        />

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
              estado: filtros.estado ?? null,
              prioridad: filtros.prioridad ?? null,
              locomotiveNumber: filtros.locomotiveNumber ?? null,
              fechaCampo: filtros.fechaCampo ?? "solicitud",
              tamPagina: filtros.tamPagina,
            }}
            listaEmpresas={listaEmpresas}
            listaLocalidades={listaLocalidades}
            puedeElegirLocalidad={puedeElegirLocalidad}
            onCambiarEmpresaId={handleCambiarEmpresaId}
            onCambiarLocalidadId={handleCambiarLocalidadId}
            onCambiarRangoFechas={handleCambiarRangoFechas}
            onCambiarEstado={handleCambiarEstado}
            onCambiarPrioridad={handleCambiarPrioridad}
            onCambiarLocomotiveNumber={handleCambiarLocomotiveNumber}
            onCambiarFechaCampo={handleCambiarFechaCampo}
            onCambiarTamPagina={handleCambiarTamPagina}
            onLimpiarFiltros={handleLimpiarFiltros}
            deshabilitado={false}
          />

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <ResumenChip label="Total filtrado" value={`${total}${totalEstimado ? "+" : ""}`} />
            <ResumenChip label="Primer inicio visible" value={formatPanelDate(resumenEjecucion.firstStart)} />
            <ResumenChip label="Último fin visible" value={formatPanelDate(resumenEjecucion.lastEnd)} />
            {puedeVerDuracionMovimiento ? (
              <ResumenChip label="Resolución promedio" value={formatPanelDuration(resumenEjecucion.avg)} />
            ) : null}
            <ResumenChip label="Orden actual" value={ordenActual} />
          </div>
        </section>

        {/* Card: Tabla */}
        <GuidedTarget id="client-movements-list" className="flex min-h-0 flex-1 flex-col">
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
            <DataEmptyState
              icon={Flag}
              title={emptyText}
              description="Ajusta los filtros o cambia de pestaña"
              className="min-h-[320px] border-0 bg-transparent"
            />
            ) : (
            <div className="relative flex-1 min-h-0">
              <Tabla
                filas={filas}
                pagina={filtros.pagina}
                tamPagina={filtros.tamPagina}
                total={total}
                totalEstimado={totalEstimado}
                campoOrden={filtros.campoOrden}
                direccionOrden={filtros.direccionOrden}
                cargando={cargando}
                rol={rol}
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
        </GuidedTarget>
      </div>
    </section>
  );
}

function ResumenChip({ label, value }: { label: string; value: string }) {
  return (
    <KpiCard label={label} value={value} compact />
  );
}
