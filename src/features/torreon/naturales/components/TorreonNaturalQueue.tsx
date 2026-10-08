"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeBoardRefresh } from "@/features/rail-queue/useRealtimeBoardRefresh";
import { isTorreonNaturalEvent } from "@/features/torreon/realtime";
import { toTorreonImageProxyUrl } from "@/lib/torreonImageProxy";

type Movement = {
  id: number;
  empresaId: number;
  empresaNombreSnapshot?: string;
  locomotiveNumber: number;
  locomotoraRemolque?: number;
  viaOrigenNombreSnapshot?: string;
  viaDestinoNombreSnapshot?: string;
  seccionOrigenNombreSnapshot?: string;
  seccionDestinoNombreSnapshot?: string;
  polo?: string;
  posicionCabina?: string;
  posicionChimenea?: string;
  tipoMovimiento?: string;
  direccionEmpuje?: string;
  instrucciones?: string;
  estado: string;
};
type Incident = {
  id: number;
  estado: string;
  motivo: string;
  solucion?: string;
  fechaInicio: string;
  fotos?: { url: string }[];
  confirmadoPorRol?: string;
  resueltoPorId?: number;
  fechaResolucion?: string;
};
type Unit = {
  id: number;
  modalidad: string;
  estado: string;
  operadorId: number | null;
  operador?: { nombre: string };
  disponible: boolean;
  posicion: number;
  fechaHabilitacion?: string;
  ordenManual: number | null;
  movimientos: Movement[];
  incidentes: Incident[];
  incidenteBloqueanteId?: number;
};
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
const field =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
export default function TorreonNaturalQueue({
  localidadId,
  rol = "CLIENTE",
}: {
  localidadId: number;
  rol?: string;
}) {
  const dispatch = ["COORDINADOR", "SUPERVISOR", "ADMINISTRADOR"].includes(rol);
  const [units, setUnits] = useState<Unit[]>([]),
    [selected, setSelected] = useState<number[]>([]);
  const [together, setTogether] = useState(false),
    [history, setHistory] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<{ id: number; nombre: string }[]>([]);
  const [assignment, setAssignment] = useState<Record<number, string>>({});
  const [solution, setSolution] = useState<Record<number, string>>({});
  const [audit, setAudit] = useState<
    { id: number; fecha: string; accion: string; usuarioId: number; rol?: string }[] | null
  >(null);
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const data = await request(`/cola?localidadId=${localidadId}&historial=${history}`);
      if (sequence !== requestSequence.current) return;
      setUnits(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      if (sequence === requestSequence.current)
        setError(e instanceof Error ? e.message : "No se pudo cargar la cola");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [localidadId, history]);
  useEffect(() => {
    setLoading(true);
    setSelected([]);
    setUnits([]);
    void load();
    return () => {
      requestSequence.current++;
    };
  }, [load]);
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
    void fetch(`/bff/usuarios?localidadId=${localidadId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.data ?? data.usuarios ?? []);
        if (active)
          setOperators(
            rows.filter(
              (u: {
                rol: string;
                activo?: boolean;
                localidadId?: number;
                localidad?: { id: number };
              }) =>
                u.rol === "MAQUINISTA" &&
                u.activo !== false &&
                Number(u.localidadId ?? u.localidad?.id) === localidadId,
            ),
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
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Movimientos naturales · Torreón</h2>
          <p className="text-sm text-slate-500">
            Reanudaciones, prioridad manual y solicitudes por llegada.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={field} onClick={() => setHistory(!history)}>
            {history ? "Ver operación" : "Ver concluidos"}
          </button>
          <button className={field} disabled={busy} onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      </div>
      {dispatch && !history && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <label>
            <input
              type="checkbox"
              checked={together}
              onChange={(e) => setTogether(e.target.checked)}
            />{" "}
            En conjunto
          </label>
          <button
            className={field}
            disabled={busy || !selected.length || (together && selected.length < 2)}
            onClick={() =>
              void mutate("/cola/priorizar", { unidadIds: selected, enConjunto: together })
            }
          >
            Subir {selected.length ? `(${selected.length})` : "selección"}
          </button>
          <p className="text-sm">
            La selección conserva el orden en que marcas las solicitudes. Sin «En conjunto», se
            atienden por separado.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {loading ? (
        <p>Cargando cola…</p>
      ) : !units.length ? (
        <p>No hay solicitudes en esta vista.</p>
      ) : (
        units.map((unit) => (
          <article
            key={unit.id}
            className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-3">
                {dispatch && unit.estado === "PENDIENTE" && (
                  <input
                    aria-label={`Seleccionar unidad ${unit.id}`}
                    type="checkbox"
                    checked={selected.includes(unit.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, unit.id] : prev.filter((id) => id !== unit.id),
                      )
                    }
                  />
                )}
                <div>
                  <strong>
                    {unit.modalidad === "CONJUNTO"
                      ? `Conjunto #${unit.id}`
                      : `Solicitud #${unit.movimientos[0]?.id}`}
                  </strong>
                  <p className="text-sm">
                    {unit.estado === "LISTA_REANUDAR"
                      ? "Reanudación prioritaria"
                      : unit.estado === "DETENIDA"
                        ? "Detenido por incidente"
                        : unit.estado === "EN_PROCESO"
                          ? "En ejecución"
                          : unit.ordenManual !== null
                            ? "Prioridad manual"
                            : "Por llegada"}{" "}
                    ·{" "}
                    {unit.operador?.nombre ??
                      (unit.operadorId ? `Maquinista #${unit.operadorId}` : "Sin asignar")}
                  </p>
                </div>
              </div>
              {dispatch && !["EN_PROCESO", "CONCLUIDA", "CANCELADA"].includes(unit.estado) && (
                <div className="flex gap-2">
                  <select
                    aria-label={`Asignar unidad ${unit.id}`}
                    className={field}
                    value={assignment[unit.id] ?? ""}
                    onChange={(e) =>
                      setAssignment((prev) => ({ ...prev, [unit.id]: e.target.value }))
                    }
                  >
                    <option value="">Maquinista</option>
                    {operators.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    className={field}
                    disabled={busy || !assignment[unit.id]}
                    onClick={() =>
                      void mutate(`/cola/${unit.id}/asignar`, {
                        operadorId: Number(assignment[unit.id]),
                      })
                    }
                  >
                    Asignar
                  </button>
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {unit.movimientos.map((m) => (
                <div key={m.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                  <strong>
                    Movimiento #{m.id} · Locomotora {m.locomotiveNumber}
                  </strong>
                  <p>
                    {m.viaOrigenNombreSnapshot ?? "Origen"} {m.seccionOrigenNombreSnapshot ?? ""} →{" "}
                    {m.viaDestinoNombreSnapshot ?? "Destino"} {m.seccionDestinoNombreSnapshot ?? ""}
                  </p>
                  <p className="text-sm">
                    {m.tipoMovimiento} · Polo: {m.polo ?? "Sin solicitar"} · Chimenea:{" "}
                    {m.posicionChimenea ?? "Sin solicitar"} · Cabina:{" "}
                    {m.posicionCabina ?? "Sin solicitar"}
                  </p>
                  {m.tipoMovimiento === "REMOLCADA" && (
                    <p>
                      Remolca: {m.locomotoraRemolque} · {m.direccionEmpuje}
                    </p>
                  )}
                  <p className="text-sm">{m.estado}</p>
                  {m.instrucciones && <p>Indicaciones: {m.instrucciones}</p>}
                </div>
              ))}
            </div>
            {unit.incidenteBloqueanteId &&
              !unit.incidentes.some((i) => i.id === unit.incidenteBloqueanteId) && (
                <p>Ruta bloqueada por incidente #{unit.incidenteBloqueanteId}.</p>
              )}
            {unit.incidentes.map((i) => (
              <div key={i.id} className="space-y-2 rounded-lg border border-amber-300 p-3">
                <p>
                  <strong>
                    Incidente #{i.id} · {i.estado}
                  </strong>{" "}
                  · {i.motivo}
                </p>
                <p className="text-sm">
                  Reportado: {new Date(i.fechaInicio).toLocaleString("es-MX")}
                </p>
                <div className="flex gap-2">
                  {i.fotos?.map((f, n) => (
                    <a
                      key={n}
                      href={toTorreonImageProxyUrl(f.url) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Evidencia {n + 1}
                    </a>
                  ))}
                </div>
                {i.solucion && (
                  <p>
                    Solución: {i.solucion} · Usuario #{i.resueltoPorId} {i.confirmadoPorRol} ·{" "}
                    {i.fechaResolucion ? new Date(i.fechaResolucion).toLocaleString("es-MX") : ""}
                  </p>
                )}
                {i.estado === "ABIERTO" && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      className={`${field} flex-1`}
                      aria-label={`Solución del incidente ${i.id}`}
                      placeholder="Describe la solución confirmada"
                      value={solution[i.id] ?? ""}
                      onChange={(e) => setSolution((prev) => ({ ...prev, [i.id]: e.target.value }))}
                    />
                    <button
                      className={field}
                      disabled={busy || (solution[i.id]?.trim().length ?? 0) < 3}
                      onClick={() =>
                        void mutate(`/incidentes/${i.id}/resolver?tipo=NATURAL`, {
                          solucion: solution[i.id],
                        })
                      }
                    >
                      Confirmar solución
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              className="text-sm underline"
              onClick={() => {
                void request(`/cola/${unit.id}/historial`)
                  .then(setAudit)
                  .catch((e) => setError(e.message));
              }}
            >
              Ver historial de operación
            </button>
          </article>
        ))
      )}
      {audit && (
        <div role="dialog" aria-label="Historial de operación" className="rounded-xl border p-4">
          <button className={field} onClick={() => setAudit(null)}>
            Cerrar historial
          </button>
          {audit.map((e) => (
            <p key={e.id}>
              {new Date(e.fecha).toLocaleString("es-MX")} · {e.accion} · Usuario #{e.usuarioId}{" "}
              {e.rol}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
