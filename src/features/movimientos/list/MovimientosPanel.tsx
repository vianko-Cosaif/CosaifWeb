"use client";
import SavedViews from "./SavedViews";
import AttentionSummary from "./AttentionSummary";
import { parseAuthorizationProfile, hasPermission, PERMISSIONS, type AuthorizationProfile } from "@/lib/accessControl";
// src/app/Components/movimientos/MovimientosPanel.tsx


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
import { GuidedTarget } from "@/features/capacitacion";
import { useTrainingTour } from "@/features/capacitacion/TrainingTourContext";
import DataEmptyState from "@/components/ui/DataEmptyState";
import KpiCard from "@/components/ui/KpiCard";
import ModuleHeader from "@/components/ui/ModuleHeader";
import LoadingState from "@/components/ui/LoadingState";
import { canViewMovementDuration } from "@/features/movimientos/table";


const Tabla = dynamic(() => import("./Tabla"), {
  loading: () => <LoadingState label="Preparando tabla de movimientos" className="min-h-[320px] border-0" />,
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
  if (minutes == null || !Number.isFinite(Number(minutes))) return "—";
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
  authorization?: AuthorizationProfile;
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
    authorization,
    puedeCrear = false,
    apiBase,
    empresaIdUsuario,
    localidadIdUsuario,
    bloquearLocalidad = false,
    intervaloAutoMs,
  } = props;
  const router = useRouter();
  const trainingTour = useTrainingTour();
  const [storedCanEdit, setCanEdit] = useState(false);
  const canEdit = authorization ? hasPermission(authorization, PERMISSIONS.MOVEMENTS_EDIT) : storedCanEdit;
  useEffect(() => {
    if (authorization) return;
    const sync = () => {
      try { setCanEdit(hasPermission(parseAuthorizationProfile(JSON.parse(localStorage.getItem("user") || "null")?.authorization), PERMISSIONS.MOVEMENTS_EDIT)); } catch { setCanEdit(false); }
    };
    sync(); window.addEventListener("storage", sync); window.addEventListener("cosaif:session-ended", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("cosaif:session-ended", sync); };
  }, [authorization]);

  const [rol, setRol] = useState<Rol>(() => authorization?.role ?? rolProp ?? getRoleFromSession());

  const [userEmpresaId, setUserEmpresaId] = useState<number | null>(
    () => authorization?.scope.empresaId ?? empresaIdUsuario ?? null
  );
  const [userLocalidadId, setUserLocalidadId] = useState<number | null>(
    () => authorization?.scope.mode !== "GLOBAL" ? authorization?.scope.localidadId ?? localidadIdUsuario ?? null : localidadIdUsuario ?? null
  );
  const rolNormalizado = String(rol || "").toUpperCase();
  const puedeVerDuracionMovimiento = canViewMovementDuration(rolNormalizado);

  /* ================== RESOLVER SESIÓN ================== */

  useEffect(() => {
    if (authorization?.role || rolProp) {
      setRol(authorization?.role ?? rolProp!);
      return;
    }
    setRol(getRoleFromSession());
  }, [rolProp, authorization?.role]);

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
        if (!authorization && userEmpresaId == null) {
          const empId = Number(u?.empresaId ?? u?.empresa?.id ?? NaN);
          if (Number.isFinite(empId)) setUserEmpresaId(empId);
        }
        if (!authorization && userLocalidadId == null) {
          const locId = Number(u?.localidadId ?? u?.localidad?.id ?? NaN);
          if (Number.isFinite(locId)) setUserLocalidadId(locId);
        }
      }
    } catch {
      // nada
    }

    if (!authorization && userLocalidadId == null) {
      const locIdCookie = Number(
        getCookie("locId") || getCookie("localidadId") || NaN
      );
      if (Number.isFinite(locIdCookie)) setUserLocalidadId(locIdCookie);
    }
  }, [authorization, userEmpresaId, userLocalidadId]);

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
    error,
    filterPolicy,
    autoEnabled,
    setAutoEnabled,
    applyView,
    emptyText,
  } = useMovimientos({
    rol,
    apiBase,
    autoRefreshMs: intervaloAutoMs,
    initialEmpresaId: userEmpresaId,
    initialLocalidadId: userLocalidadId,
    authorization,
    bloquearLocalidad,
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

  const puedeElegirLocalidad = filterPolicy.canEditLocalidad;
  const puedeVerTodasEmpresas = filterPolicy.canEditEmpresa;

  const listaEmpresas = useMemo(() => {
    if (puedeVerTodasEmpresas) return empresas;
    if (userEmpresaId != null) {
      const e = empresas.find((x) => x.id === userEmpresaId);
      return e ? [e] : [{ id: userEmpresaId, nombre: `Empresa #${userEmpresaId}` }];
    }
    return empresas;
  }, [empresas, puedeVerTodasEmpresas, userEmpresaId]);

  const listaLocalidades = useMemo(() => {
    if (puedeElegirLocalidad) return localidades;
    if (userLocalidadId != null) {
      const l = localidades.find((x) => x.id === userLocalidadId);
      return l ? [l] : [{ id: userLocalidadId, nombre: `Localidad #${userLocalidadId}` }];
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
    },
    [setAmbito]
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
      if (!puedeVerTodasEmpresas) return;
      setFiltros((prev) => ({
        ...prev,
        pagina: 1,
        empresaId: empresaId ?? undefined,
      }));
    },
    [setFiltros, puedeVerTodasEmpresas]
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
      empresaId: filterPolicy.forcedEmpresaId,
      localidadId: filterPolicy.forcedLocalidadId,
      busqueda: '',
      locomotivePrefix: undefined,
      desde: undefined,
      hasta: undefined,
      estado: undefined,
      prioridad: undefined,
      locomotiveNumber: undefined,
      fechaCampo: "solicitud",
    }));
  }, [setFiltros, filterPolicy.forcedEmpresaId, filterPolicy.forcedLocalidadId]);

  const handlePagina = useCallback(
    (pagina: number) => {
      setFiltros((prev) => ({
        ...prev,
        pagina,
      }));
    },
    [setFiltros]
  );

  const puedeEditarFila = useCallback((movement: Movement) => {
    if (trainingTour.isTrainingMovement(movement.id)) return trainingTour.active;
    if (!canEdit) return false;
    if (rol === 'CLIENTE') return movement.empresaId === userEmpresaId && movement.localidadId === userLocalidadId;
    return true;
  }, [trainingTour, canEdit, rol, userEmpresaId, userLocalidadId]);

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
      const row = filas.find(movement => (movement.idTecnico ?? movement.id) === id);
      if (!row || !puedeEditarFila(row)) return;
      const BASE: Record<string, string> = {
        ADMINISTRADOR: "/administrador",
        COORDINADOR: "/coordinador",
        SUPERVISOR: "/supervisor",
        CLIENTE: "/cliente",
      };
      const base = BASE[String(rol).toUpperCase()] ?? "/cliente";
      router.push(`${base}/editar?id=${id}`);
    },
    [router, rol, trainingTour, filas, puedeEditarFila]
  );

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
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:gap-5 sm:p-5">
        {trainingTour.active ? (
          <div className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-100" role="status">
            CAPACITACIÓN ACTIVA · Los registros SIM y todas sus acciones se guardan sólo en esta sesión.
          </div>
        ) : null}
        <ModuleHeader
          icon={Flag}
          title="Movimientos"
          subtitle="Consulta solicitudes, avance e historial de la operación."
          badge={ambito === "actuales" ? "Activos" : "Historial"}
          loading={cargando}
          actions={
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--app-surface-muted)] px-3 py-1.5 text-xs">
              <span className="font-semibold tabular-nums text-[var(--app-accent)]">{(cargando || error) && displayedRows.length === 0 ? "—" : `${displayedTotal}${totalEstimado ? "+" : ""}`}</span>
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
            p-4 sm:p-5 
            shadow-sm
          "
        >
          <Nav
            ambito={ambito}
            busqueda={filtros.busqueda}
            autoActualizacion={ambito === "actuales" && autoEnabled}
            estaCargando={cargando}
            contadores={{ actuales: ambito === 'actuales' && !cargando && !error ? displayedTotal : undefined, pasados: ambito === 'pasados' && !cargando && !error ? displayedTotal : undefined }}
            puedeCrear={puedeCrear}
            onCambiarAmbito={handleCambiarAmbito}
            onBuscar={handleBuscar}
            onToggleAuto={setAutoEnabled}
            onRefrescar={recargar}
            onNuevo={handleNuevo}
          />

          <Filtros
            expandirPorCapacitacion={trainingTour.active}
            ambito={ambito}
            actualesCompartidos={rol === 'CLIENTE' && ambito === 'actuales'}
            puedeElegirEmpresa={puedeVerTodasEmpresas}
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

          {rol === 'CLIENTE' ? <p className="text-sm text-[var(--app-text-muted)]">{ambito === 'actuales' ? 'Rondas actuales de todas las empresas de tu localidad. Solo puedes editar movimientos de tu empresa.' : 'Historial de movimientos de tu empresa y tu localidad.'}</p> : null}
          {!trainingTour.active ? <SavedViews filtros={filtros} ambito={ambito} onApply={applyView}/> : null}
          {ambito === 'actuales' && displayedRows.length > 0 ? <AttentionSummary rows={displayedRows} onState={(estado) => {
            if (estado === 'DETENIDO' && rol !== 'CLIENTE') setAmbito('pasados');
            handleCambiarEstado(estado);
          }}/> : null}
          {error ? <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">{error} <button type="button" className="ml-2 underline" onClick={recargar}>Reintentar</button></div> : null}
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
            <ResumenChip label="Total filtrado" value={(cargando || error) && displayedRows.length === 0 ? "—" : `${displayedTotal}${totalEstimado ? "+" : ""}`} />
            <ResumenChip label="Primer inicio visible" value={formatPanelDate(resumenEjecucion.firstStart)} />
            <ResumenChip label="Último fin visible" value={formatPanelDate(resumenEjecucion.lastEnd)} />
            {puedeVerDuracionMovimiento ? (
              <ResumenChip label="Duración promedio visible" value={formatPanelDuration(resumenEjecucion.avg)} />
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
            {displayedRows.length === 0 ? (
              cargando ? <LoadingState label="Cargando movimientos" className="min-h-[320px] border-0" /> : (
                <DataEmptyState
                  icon={Flag}
                  title={error ? "Listado no disponible" : emptyText}
                  description={error ? "Reintenta la consulta para ver los movimientos." : "Prueba con otros filtros o consulta el otro periodo."}
                  className="min-h-[320px] border-0 bg-transparent"
                />
              )
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
                onEditar={trainingTour.active || canEdit ? handleEditar : undefined}
                puedeEditarFila={puedeEditarFila}
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
