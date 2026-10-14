"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUp,
  Home,
  ListChecks,
  CheckCircle2,
  Clock3,
  ListOrdered,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  TrainFront,
  X,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useRealtimeBoardRefresh } from "@/features/rail-queue/useRealtimeBoardRefresh";
import { isTorreonNaturalEvent } from "@/features/torreon/realtime";
import NaturalQueueTable from "./NaturalQueueTable";
import {
  dateLabel,
  filterQueue,
  queueUnitLabel,
  type QueueAudit,
  type QueueUnit,
} from "../queueView";
import { auditEventView, uniqueAuditEvents } from "../auditView";
import s from "./naturalQueue.module.scss";

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/bff/torreon${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? data.error ?? "No se pudo completar la operación");
  return data;
}
export default function TorreonNaturalQueue({
  localidadId,
  rol = "CLIENTE",
  view = "inicio",
  canCreateMovements = false,
}: {
  localidadId: number;
  rol?: string;
  view?: "inicio" | "seguimiento";
  canCreateMovements?: boolean;
}) {
  const dispatch = ["COORDINADOR", "SUPERVISOR", "ADMINISTRADOR"].includes(rol);
  const isClient = ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(rol);
  const showWaitTime = ["COORDINADOR", "SUPERVISOR"].includes(rol);
  const area = isClient ? "cliente" : rol.toLowerCase();
  const [units, setUnits] = useState<QueueUnit[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [together, setTogether] = useState(false);
  const [history, setHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [coordinator, setCoordinator] = useState("");
  const [dateField, setDateField] = useState<"solicitud" | "inicio" | "fin">("solicitud");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<{ id: number; nombre: string }[]>([]);
  const [audit, setAudit] = useState<{
    unitId: number;
    entries: QueueAudit[];
    loading: boolean;
    error: string;
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const auditSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const data = await request(
        `/cola?localidadId=${localidadId}&historial=${view === "seguimiento" && history}`,
      );
      if (sequence !== requestSequence.current) return;
      const rows: QueueUnit[] = Array.isArray(data) ? data : [];
      setUnits(rows);
      setSelected((prev) =>
        prev.filter((id) => rows.some((u) => u.id === id && u.estado === "PENDIENTE")),
      );
      setUpdatedAt(new Date().toISOString());
      setError("");
    } catch (e) {
      if (sequence === requestSequence.current)
        setError(e instanceof Error ? e.message : "No se pudo cargar la cola");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [localidadId, history, view]);
  const cancelPendingLoad = useCallback(() => {
    requestSequence.current++;
  }, []);
  useEffect(() => {
    setLoading(true);
    setSelected([]);
    setUnits([]);
    setState("");
    setCoordinator("");
    void load();
    return cancelPendingLoad;
  }, [load, cancelPendingLoad]);
  useRealtimeBoardRefresh({
    enabled: true,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    matchesEvent: isTorreonNaturalEvent,
    onRefresh: () => load(),
  });
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!dispatch) return;
    let active = true;
    void fetch(`/bff/torreon/cola/maquinistas?localidadId=${localidadId}`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los maquinistas");
        return r.json();
      })
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.data ?? data.usuarios ?? []);
        if (active)
          setOperators(
            rows
              .filter(
                (u: { id?: number; nombre?: string }) =>
                  Number.isSafeInteger(Number(u.id)) &&
                  Number(u.id) > 0 &&
                  typeof u.nombre === "string",
              )
              .map((u: { id: number; nombre: string }) => ({ id: Number(u.id), nombre: u.nombre })),
          );
      })
      .catch(() => {
        if (active) setOperators([]);
      });
    return () => {
      active = false;
    };
  }, [dispatch, localidadId]);
  const mutate = async (path: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await request(path, "PATCH", body);
      setSelected([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };
  const openAudit = async (unitId: number) => {
    const sequence = ++auditSequence.current;
    setAudit({ unitId, entries: [], loading: true, error: "" });
    try {
      const entries = await request(`/cola/${unitId}/historial`);
      if (sequence === auditSequence.current)
        setAudit({
          unitId,
          entries: Array.isArray(entries) ? entries : [],
          loading: false,
          error: "",
        });
    } catch (e) {
      if (sequence === auditSequence.current)
        setAudit({
          unitId,
          entries: [],
          loading: false,
          error: e instanceof Error ? e.message : "No se pudo cargar el historial",
        });
    }
  };
  const visible = useMemo(
    () =>
      filterQueue(
        units,
        search,
        state,
        coordinator,
        view === "seguimiento" ? { field: dateField, from: dateFrom, to: dateTo } : undefined,
      ),
    [units, search, state, coordinator, view, dateField, dateFrom, dateTo],
  );
  const movementsCount = units.reduce((total, unit) => total + unit.movimientos.length, 0);
  const visibleCount = visible.reduce((total, unit) => total + unit.movimientos.length, 0);
  const coordinatorOptions = useMemo(() => {
    const options = new Map<number, string>();
    for (const unit of units)
      for (const movement of unit.movimientos) {
        const id = movement.coordinadorId ?? movement.coordinador?.id;
        if (id) options.set(id, movement.coordinador?.nombre ?? `Coordinador #${id}`);
      }
    return [...options].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [units]);
  const names = useMemo(() => {
    const result = new Map<number, string>();
    for (const unit of units)
      for (const m of unit.movimientos)
        for (const person of [
          m.coordinador,
          m.operador,
          m.supervisor,
          m.creadoPor,
          m.cliente,
          unit.operador,
        ])
          if (person?.id) result.set(person.id, person.nombre);
    return result;
  }, [units]);
  const auditUnit = units.find((item) => item.id === audit?.unitId);
  const auditRows = useMemo(() => {
    return uniqueAuditEvents(audit?.entries ?? []).map((event) => ({
      event,
      ...auditEventView(event, auditUnit, names),
    }));
  }, [audit, auditUnit, names]);
  const hasFilters = Boolean(search || state || coordinator || dateFrom || dateTo);
  const dateError =
    dateFrom && dateTo && dateFrom > dateTo
      ? "La fecha desde no puede ser posterior a la fecha hasta."
      : "";
  const clearFilters = () => {
    setSearch("");
    setState("");
    setCoordinator("");
    setDateFrom("");
    setDateTo("");
    setSelected([]);
  };
  const countMovements = (status: string) =>
    units.reduce(
      (total, unit) => total + (unit.estado === status ? unit.movimientos.length : 0),
      0,
    );
  const visibleGroups = visible.filter((unit) => unit.modalidad === "CONJUNTO").length;
  const visibleIndividuals = visible.length - visibleGroups;
  const metrics = history
    ? [
        {
          label: "Movimientos",
          value: movementsCount,
          icon: TrainFront,
          tone: "neutral",
        },
        {
          label: "Concluidos",
          value: countMovements("CONCLUIDA"),
          icon: CheckCircle2,
          tone: "green",
        },
        {
          label: "Cancelados",
          value: countMovements("CANCELADA"),
          icon: X,
          tone: "neutral",
        },
      ]
    : [
        {
          label: "Movimientos",
          value: movementsCount,
          icon: TrainFront,
          tone: "neutral",
        },
        {
          label: "Por iniciar",
          value: countMovements("PENDIENTE"),
          icon: Clock3,
          tone: "amber",
        },
        {
          label: "En curso",
          value: countMovements("EN_PROCESO"),
          icon: TrainFront,
          tone: "blue",
        },
        {
          label: "Con incidente",
          value: countMovements("DETENIDA"),
          icon: PauseCircle,
          tone: "red",
        },
        {
          label: "Listos para continuar",
          value: countMovements("LISTA_REANUDAR"),
          icon: ListOrdered,
          tone: "green",
        },
      ];
  return (
    <section
      className={s.board}
      data-view={view}
      aria-labelledby="torreon-natural-title"
      aria-busy={loading || busy}
    >
      <nav className={s.navigation} aria-label="Navegación de movimientos de Torreón">
        <Link
          className={s.navigationLink}
          href={`/${area}${isClient ? `?loc=${localidadId}` : ""}`}
          aria-current={view === "inicio" ? "page" : undefined}
        >
          <Home size={15} aria-hidden /> Inicio
        </Link>
        <Link
          className={s.navigationLink}
          href={`/${area}/movimientos${isClient ? `?loc=${localidadId}` : ""}`}
          aria-current={view === "seguimiento" ? "page" : undefined}
        >
          <ListChecks size={15} aria-hidden /> Seguimiento
        </Link>
        {isClient && (
          <Link
            className={s.incidentsLink}
            href="/cliente/incidentes?source=torreon&tipo=NATURAL"
            aria-label="Incidentes de mi empresa"
          >
            <AlertTriangle size={15} aria-hidden /> Incidentes
            <span>Mi empresa</span>
          </Link>
        )}
      </nav>
      <header className={s.header}>
        <div className={s.heading}>
          <span className={s.headingIcon}>
            {view === "seguimiento" ? (
              <ListChecks size={22} aria-hidden />
            ) : (
              <TrainFront size={22} aria-hidden />
            )}
          </span>
          <div>
            <span className={s.eyebrow}>
              {view === "seguimiento"
                ? "CONSULTA DE MOVIMIENTOS · TORREÓN"
                : "CONTROL DE OPERACIÓN · TORREÓN"}
            </span>
            <h2 id="torreon-natural-title">
              {view === "seguimiento" ? "Seguimiento de movimientos" : "Movimientos naturales"}
            </h2>
            <p>
              {isClient
                ? history && view === "seguimiento"
                  ? "Historial de movimientos de tu empresa · solo consulta."
                  : "Vista general de todas las empresas del patio · solo consulta."
                : view === "inicio"
                  ? "Solicitudes activas, recorrido y responsables en el patio."
                  : "Revisa solicitudes activas, consulta su detalle y explora el historial."}
            </p>
          </div>
        </div>
        <div className={s.headerActions}>
          {isClient && canCreateMovements && (
            <Link href="/movimientos/crear?tipo=NATURAL" className={s.primaryButton}>
              <Plus size={15} aria-hidden /> Solicitar movimientos
            </Link>
          )}
          <button
            type="button"
            className={s.button}
            disabled={busy || loading}
            onClick={() => void load()}
          >
            <RefreshCw size={15} aria-hidden /> Actualizar
          </button>
        </div>
      </header>
      {view === "seguimiento" && (
        <div className={s.followUpTabs}>
          <div className={s.switcher} role="group" aria-label="Período de seguimiento">
            <button
              type="button"
              disabled={busy}
              aria-pressed={!history}
              onClick={() => setHistory(false)}
            >
              <Clock3 size={16} aria-hidden /> Activos
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={history}
              onClick={() => setHistory(true)}
            >
              <CheckCircle2 size={16} aria-hidden /> Historial
            </button>
          </div>
          <span>
            {history
              ? isClient
                ? "Solicitudes concluidas y canceladas de tu empresa"
                : "Solicitudes concluidas y canceladas de todas las empresas"
              : "Solicitudes en espera, detenidas y en proceso"}
          </span>
        </div>
      )}
      <div className={s.metrics} role="group" aria-label="Resumen de movimientos">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={s.metric} data-tone={tone}>
            <span className={s.metricIcon}>
              <Icon size={17} aria-hidden />
            </span>
            <div>
              <strong>{loading ? "—" : value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={s.toolbar} role="search" aria-label="Buscar y filtrar movimientos">
        <div className={s.filterHeading}>
          <div>
            <h3>Buscar y filtrar</h3>
            <p>Encuentra movimientos por locomotora, recorrido o responsable.</p>
          </div>
          {hasFilters && (
            <button type="button" className={s.textButton} onClick={clearFilters}>
              <X size={14} aria-hidden /> Limpiar
            </button>
          )}
        </div>
        <div className={s.filterGrid}>
          <label className={`${s.filterField} ${s.searchField}`}>
            <span>Buscar movimiento</span>
            <span className={s.search}>
              <Search size={17} aria-hidden />
              <input
                aria-label="Buscar movimientos"
                placeholder="Locomotora, vía, empresa o nombre"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected([]);
                }}
              />
            </span>
          </label>
          <label className={s.filterField}>
            <span>Estado</span>
            <select
              className={s.field}
              aria-label="Filtrar por estado"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">Todos los estados</option>
              {history ? (
                <>
                  <option value="CONCLUIDA">Concluidos</option>
                  <option value="CANCELADA">Cancelados</option>
                </>
              ) : (
                <>
                  <option value="PENDIENTE">Por iniciar</option>
                  <option value="EN_PROCESO">En curso</option>
                  <option value="DETENIDA">Con incidente</option>
                  <option value="LISTA_REANUDAR">Listos para continuar</option>
                </>
              )}
            </select>
          </label>
          <label className={s.filterField}>
            <span>Coordinador</span>
            <select
              className={s.field}
              aria-label="Filtrar por coordinador"
              value={coordinator}
              onChange={(e) => {
                setCoordinator(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">Todos los coordinadores</option>
              {coordinatorOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {view === "seguimiento" && (
          <div className={s.dateFilters}>
            <label className={s.filterField}>
              <span>Consultar por fecha de</span>
              <select
                className={s.field}
                aria-label="Fecha a consultar"
                value={dateField}
                onChange={(event) => {
                  setDateField(event.target.value as typeof dateField);
                  setSelected([]);
                }}
              >
                <option value="solicitud">Fecha de solicitud</option>
                <option value="inicio">Fecha de inicio</option>
                <option value="fin">Fecha de fin</option>
              </select>
            </label>
            <label className={s.filterField}>
              <span>Desde</span>
              <input
                className={s.field}
                type="date"
                value={dateFrom}
                aria-label="Desde"
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? "torreon-date-error" : undefined}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setSelected([]);
                }}
              />
            </label>
            <label className={s.filterField}>
              <span>Hasta</span>
              <input
                className={s.field}
                type="date"
                value={dateTo}
                aria-label="Hasta"
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? "torreon-date-error" : undefined}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setSelected([]);
                }}
              />
            </label>
            <p className={s.dateHint}>Fechas del patio de Torreón. Puedes usar sólo un límite.</p>
          </div>
        )}
      </div>
      {dateError && (
        <p role="alert" className={s.error} id="torreon-date-error">
          {dateError}
        </p>
      )}
      {dispatch && !history && (
        <div className={s.dispatchBar}>
          <div className={s.dispatchHeading}>
            <strong>Priorizar solicitudes</strong>
            <span>
              {selected.length
                ? `${selected.length} elementos seleccionados`
                : "Selecciona las solicitudes o conjuntos que deseas priorizar."}
            </span>
          </div>
          <label className={s.checkLabel}>
            <input
              type="checkbox"
              checked={together}
              onChange={(e) => setTogether(e.target.checked)}
            />{" "}
            En conjunto
          </label>
          <button
            type="button"
            className={s.primaryButton}
            disabled={busy || !selected.length || (together && selected.length < 2)}
            onClick={() =>
              void mutate("/cola/priorizar", {
                unidadIds: selected,
                enConjunto: together,
              })
            }
          >
            <ArrowUp size={15} aria-hidden /> Subir{" "}
            {selected.length ? `(${selected.length})` : "selección"}
          </button>
          {selected.length > 0 && (
            <small>
              Subir les da prioridad en el orden seleccionado. «En conjunto» reúne la selección para
              atenderla como una sola operación.
            </small>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className={s.error}>
          {error}
          <button
            type="button"
            className={s.textButton}
            disabled={busy}
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      )}
      <div className={s.resultsHeading}>
        <div>
          <h3>
            {history
              ? "Historial de movimientos"
              : view === "seguimiento"
                ? "Registro de movimientos"
                : "Orden de atención"}
          </h3>
          <span>
            {visibleCount} {visibleCount === 1 ? "movimiento" : "movimientos"}
            {hasFilters ? " encontrados" : " en esta vista"}
          </span>
        </div>
        <p>
          {view === "seguimiento"
            ? "Más recientes primero · Folio de mayor a menor. Abre el folio para ver el detalle."
            : hasFilters
              ? "Los conjuntos conservan sus integrantes visibles."
              : "Abre Detalle para consultar el movimiento."}
        </p>
        <span className={s.scrollHint}>Desliza la tabla para ver todas las columnas →</span>
      </div>
      {loading ? (
        <div className={s.empty} role="status">
          <RefreshCw size={24} aria-hidden />
          <strong>Cargando movimientos…</strong>
        </div>
      ) : !visible.length ? (
        <div className={s.empty}>
          <TrainFront size={30} aria-hidden />
          <strong>
            {hasFilters ? "No hay coincidencias" : "No hay solicitudes en esta vista"}
          </strong>
          <p>
            {hasFilters
              ? "Prueba con otra locomotora, vía o responsable."
              : history
                ? "Los movimientos finalizados aparecerán aquí."
                : "Las nuevas solicitudes aparecerán en orden de atención."}
          </p>
          {hasFilters && (
            <button type="button" className={s.button} onClick={clearFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <NaturalQueueTable
          units={visible}
          followUp={view === "seguimiento"}
          paginationKey={JSON.stringify([
            localidadId,
            history,
            search,
            state,
            coordinator,
            dateField,
            dateFrom,
            dateTo,
          ])}
          dispatch={dispatch && !history}
          canResolveIncidents={dispatch}
          showWaitTime={showWaitTime}
          showImages={true}
          showFinish={view === "seguimiento"}
          selected={selected}
          onSelect={(id, checked) =>
            setSelected((prev) => (checked ? [...prev, id] : prev.filter((value) => value !== id)))
          }
          operators={operators}
          busy={busy}
          mutate={mutate}
          onHistory={(id) => void openAudit(id)}
        />
      )}
      <footer className={s.footer}>
        <span>
          <strong>{visibleCount}</strong> de {movementsCount} movimientos
          {visibleIndividuals > 0 &&
            ` · ${visibleIndividuals} ${visibleIndividuals === 1 ? "solicitud individual" : "solicitudes individuales"}`}
          {visibleGroups > 0 &&
            ` · ${visibleGroups} ${visibleGroups === 1 ? "conjunto" : "conjuntos"}`}
        </span>
        <span className={s.footerNote}>
          <span className={s.liveDot} />
          {updatedAt
            ? `Actualizado ${new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Monterrey" }).format(new Date(updatedAt))}`
            : "Actualización automática"}
        </span>
        <span>Atención: primero reanudaciones, después prioridad y orden de llegada.</span>
      </footer>
      {audit && (
        <Modal
          title={`Historial de operación · ${auditUnit ? queueUnitLabel(auditUnit) : `Operación #${audit.unitId}`}`}
          onClose={() => {
            auditSequence.current++;
            setAudit(null);
          }}
          closeLabel="Cerrar historial"
          className={s.auditModal}
          bodyClassName={s.auditBody}
        >
          {audit.loading ? (
            <p role="status">Cargando historial…</p>
          ) : audit.error ? (
            <p role="alert">{audit.error}</p>
          ) : !audit.entries.length ? (
            <p className={s.muted}>No hay eventos registrados para esta solicitud.</p>
          ) : (
            <>
              <p className={s.auditIntro}>
                Eventos en orden cronológico. Incluye el historial de cada movimiento del conjunto,
                cuando corresponde.
              </p>
              <ol className={s.auditList}>
                {auditRows.map(({ event, title, actor, target, detail }) => (
                  <li key={event.id} data-system={actor === "Sistema"}>
                    <span className={s.auditDot} />
                    <div>
                      <strong>{title}</strong>
                      {target && <span className={s.auditTarget}>{target}</span>}
                      {detail && <p>{detail}</p>}
                      <p>{actor}</p>
                      <time dateTime={event.fecha}>
                        {dateLabel(event.fecha, { seconds: true })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
