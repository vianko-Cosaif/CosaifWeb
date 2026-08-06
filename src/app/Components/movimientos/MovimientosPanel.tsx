// src/app/Components/movimientos/MovimientosPanel.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Flag } from "lucide-react";
import Nav from "./Nav";
import Filtros from "./Filtros";
import { useMovimientos, type FechaCampo, type Rol, type Movement } from "./useMovimientos";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { useTrainingTour } from "@/app/Components/GuidedManualAtom/TrainingTourContext";
import DataEmptyState from "@/app/Components/ui/DataEmptyState";
import KpiCard from "@/app/Components/ui/KpiCard";
import ModuleHeader from "@/app/Components/ui/ModuleHeader";
import { canViewMovementDuration } from "@/features/movimientos/table";
import { getRoleCapabilities } from "@/lib/accessControl";

const Tabla = dynamic(() => import("./Tabla"), {
  loading: () => <div className="min-h-[320px] animate-pulse rounded-lg bg-[var(--app-surface-muted)]" />,
});

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
  const trainingTour = useTrainingTour();

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
    initialLocalidadId:
      bloquearLocalidad && userLocalidadId != null
        ? userLocalidadId
        : roleCapabilities.canSwitchLocalidad
          ? null
          : userLocalidadId,
  });

  const trainingRows = useMemo(() => {
    if (!trainingTour.active) return [];
    return trainingTour.movements.filter((movement) => {
      const isPast = movement.finalizado || ["CONCLUIDO", "CANCELADO", "RESUELTO"].includes(String(movement.estado || "").toUpperCase());
      return ambito === "pasados" ? isPast : !isPast;
    });
  }, [ambito, trainingTour.active, trainingTour.movements]);
  const displayedRows = useMemo(() => {
    if (!trainingRows.length) return filas;
    const trainingIds = new Set(trainingRows.map((movement) => movement.id));
    return [...trainingRows, ...filas.filter((movement) => !trainingIds.has(movement.id))];
  }, [filas, trainingRows]);
  const displayedTotal = total + trainingRows.filter(
    (movement) => !filas.some((row) => row.id === movement.id)
  ).length;

  /* ================== PERMISOS POR ROL ================== */

  const puedeElegirLocalidad = roleCapabilities.canSwitchLocalidad && !bloquearLocalidad;
  const puedeVerTodasEmpresas = roleCapabilities.canViewAllCompanies;

  useEffect(() => {
    const shouldForceEmpresa = !roleCapabilities.canViewAllCompanies && userEmpresaId != null;
    const shouldForceLocalidad =
      userLocalidadId != null && (bloquearLocalidad || !roleCapabilities.canSwitchLocalidad);

    if (!shouldForceEmpresa && !shouldForceLocalidad) return;

    setFiltros((prev) => ({
      ...prev,
      empresaId:
        shouldForceEmpresa
          ? userEmpresaId
          : prev.empresaId ?? undefined,
      localidadId:
        shouldForceLocalidad
          ? userLocalidadId
          : prev.localidadId ?? undefined,
      pagina: 1,
    }));
  }, [bloquearLocalidad, roleCapabilities.canSwitchLocalidad, roleCapabilities.canViewAllCompanies, userEmpresaId, userLocalidadId, setFiltros]);

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

  const resumenEjecucion = useMemo(() => buildExecutionSummary(displayedRows), [displayedRows]);
  const ordenActual = useMemo(() => {
    const labelMap: Record<string, string> = {
      id: "Folio",
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
      if (trainingTour.active) {
        if (trainingTour.isTrainingMovement(id)) {
          router.push(`/cliente/editar?id=${id}&training=1`);
          return;
        }
        window.alert("Durante la capacitación sólo puedes editar registros SIM. No se abrió ni modificó el movimiento real.");
        return;
      }
      const BASE: Record<string, string> = {
        ADMINISTRADOR: "/administrador",
        COORDINADOR: "/coordinador",
        SUPERVISOR: "/supervisor",
        CLIENTE: "/cliente",
      };
      const base = BASE[String(rol).toUpperCase()] ?? "/cliente";
      router.push(`${base}/editar?id=${id}`);
    },
    [router, rol, trainingTour]
  );

  const handleToggleAuto = useCallback(() => {
    // El auto-refresh ya lo maneja useMovimientos en "actuales"
  }, []);

  const handleNuevo = useCallback(() => {
    router.push(trainingTour.active ? "/movimientos/crear?training=1" : "/movimientos/crear");
  }, [router, trainingTour.active]);

  /* ================== RENDER ================== */

  return (
    <section
      className="
        w-full 
        rounded-lg
        border border-[var(--app-border)]
        bg-[var(--app-surface)]
        text-[var(--app-text)]
        shadow-[var(--app-shadow-sm)]
        overflow-x-hidden overflow-y-visible
        touch-manipulation
      "
    >
      <div className="flex flex-col gap-3 sm:gap-5 px-2 py-3 sm:px-5 sm:py-6 lg:px-7 lg:py-8 min-w-0">
        {trainingTour.active ? (
          <div className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-100" role="status">
            CAPACITACIÓN ACTIVA · Los registros SIM y todas sus acciones se guardan sólo en esta sesión.
          </div>
        ) : null}
        <ModuleHeader
          icon={Flag}
          title="Movimientos"
          subtitle="Gestión ferroviaria"
          badge={tab}
          loading={cargando}
          actions={
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--app-surface-muted)] px-3 py-1.5 text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{displayedTotal}</span>
              <span className="text-slate-500 dark:text-slate-400">registro{displayedTotal === 1 ? "" : "s"}</span>
            </div>
          }
        />

        <div className="h-px bg-[var(--app-border)]" />

        {/* Card: Nav + Filtros */}
        <section
          className="
            space-y-3 
            rounded-lg
            border border-[var(--app-border)]
            bg-[var(--app-surface-subtle)]
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
              actuales: (badges.Actuales ?? 0) + (trainingTour.active ? trainingTour.movements.filter((movement) => !movement.finalizado && !["CONCLUIDO", "CANCELADO", "RESUELTO"].includes(String(movement.estado || "").toUpperCase())).length : 0),
              pasados: ambito === "pasados" ? displayedTotal : 0,
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
            <ResumenChip label="Total filtrado" value={`${displayedTotal}${totalEstimado ? "+" : ""}`} />
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
              rounded-lg
              border border-[var(--app-border)]
              bg-[var(--app-surface)]
              px-1 py-1.5 sm:px-3 sm:py-3 lg:px-4 lg:py-4
              flex flex-col
              overflow-x-hidden overflow-y-visible
              shadow-sm
            "
          >
            {displayedRows.length === 0 && !cargando ? (
            <DataEmptyState
              icon={Flag}
              title={emptyText}
              description="Ajusta los filtros o cambia de pestaña"
              className="min-h-[320px] border-0 bg-transparent"
            />
            ) : (
            <div className="relative flex-1 min-h-0">
              <Tabla
                filas={displayedRows}
                pagina={filtros.pagina}
                tamPagina={filtros.tamPagina}
                total={displayedTotal}
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
