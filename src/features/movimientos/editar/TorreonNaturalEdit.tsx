"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, TrainFront } from "lucide-react";
import { API_BASE, SECC_BASE } from "@/features/movimientos/movimientos.shared";
import { sectionPositionLabel } from "@/features/torreon/naturales/queueView";

type Movement = {
  id: number;
  estado: string;
  localidadId?: number;
  fechaInicio?: string | null;
  unidad?: { estado: string; fechaInicio?: string | null } | null;
  locomotoraRemolque?: number | null;
  locomotiveNumber: number;
  prioridad: "BAJA" | "ALTA";
  tipoMovimiento: "MD_TRABAJANDO" | "REMOLCADA" | null;
  instrucciones: string | null;
  poloOrigen?: "NORTE" | "CENTRO" | "SUR" | null;
  poloDestino?: "NORTE" | "CENTRO" | "SUR" | null;
  viaOrigenId?: number | null;
  viaDestinoId?: number | null;
  seccionOrigenId?: number | null;
  seccionDestinoId?: number | null;
  seccionOrigenNumero?: number | null;
  seccionDestinoNumero?: number | null;
  direccionEmpuje: "Sin_Solicitar" | "EMPUJAR" | "JALAR" | null;
  viaOrigenNombreSnapshot?: string | null;
  viaDestinoNombreSnapshot?: string | null;
  seccionOrigenNombreSnapshot?: string | null;
  seccionDestinoNombreSnapshot?: string | null;
};

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message || payload.error || "No se pudo guardar el movimiento.");
  return payload;
}

function editFields(movement: Movement) {
  return {
    locomotiveNumber: Number(movement.locomotiveNumber),
    prioridad: movement.prioridad,
    viaOrigenId: movement.viaOrigenId || null,
    viaDestinoId: movement.viaDestinoId || null,
    locomotoraRemolque:
      movement.tipoMovimiento === "REMOLCADA" ? movement.locomotoraRemolque || null : null,
    tipoMovimiento: movement.tipoMovimiento || "MD_TRABAJANDO",
    instrucciones: movement.instrucciones?.trim() || null,
    poloOrigen: movement.poloOrigen || null,
    poloDestino: movement.poloDestino || null,
    seccionOrigenId: movement.seccionOrigenId || null,
    seccionDestinoId: movement.seccionDestinoId || null,
    direccionEmpuje:
      movement.tipoMovimiento === "REMOLCADA"
        ? movement.direccionEmpuje || "Sin_Solicitar"
        : "Sin_Solicitar",
  };
}

const field =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const label = "block text-sm font-semibold text-slate-700 dark:text-slate-200";

export default function TorreonNaturalEdit({ movimientoId }: { movimientoId: number }) {
  const router = useRouter();
  const [movement, setMovement] = useState<Movement | null>(null);
  const [initialMovement, setInitialMovement] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [vias, setVias] = useState<{ id: number; nombre: string }[]>([]);
  const [viasError, setViasError] = useState("");
  const [viasLoading, setViasLoading] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [sections, setSections] = useState<
    Record<number, { id: number; numero: number; nombre?: string | null }[]>
  >({});
  const [sectionErrors, setSectionErrors] = useState<Record<number, string>>({});
  const loadSections = useCallback(async (viaId: number, signal?: AbortSignal) => {
    setSectionErrors((previous) => ({ ...previous, [viaId]: "" }));
    try {
      const payload = await readJson(
        await fetch(`${SECC_BASE}/via/${viaId}`, { cache: "no-store", signal }),
      );
      const rows = Array.isArray(payload) ? payload : (payload.data ?? payload.secciones);
      if (!Array.isArray(rows)) throw new Error("No se pudieron cargar las secciones.");
      if (!signal?.aborted) setSections((previous) => ({ ...previous, [viaId]: rows }));
    } catch (reason) {
      if (!signal?.aborted)
        setSectionErrors((previous) => ({
          ...previous,
          [viaId]:
            reason instanceof Error ? reason.message : "No se pudieron cargar las secciones.",
        }));
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    for (const viaId of new Set([movement?.viaOrigenId, movement?.viaDestinoId]))
      if (viaId) void loadSections(viaId, controller.signal);
    return () => controller.abort();
  }, [movement?.viaOrigenId, movement?.viaDestinoId, loadSections]);

  useEffect(() => {
    if (!initialMovement?.localidadId) return;
    const controller = new AbortController();
    setViasLoading(true);
    setViasError("");
    fetch(`${API_BASE}/vias/localidad/${initialMovement.localidadId}/lite`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readJson)
      .then((payload) => {
        const rows = Array.isArray(payload) ? payload : (payload.data ?? payload.vias);
        if (!Array.isArray(rows)) throw new Error("No se pudieron cargar las vías.");
        if (!controller.signal.aborted) setVias(rows);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setViasError(
            reason instanceof Error ? reason.message : "No se pudieron cargar las vías.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setViasLoading(false);
      });
    return () => controller.abort();
  }, [initialMovement?.localidadId, catalogRetry]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cliente/torreon/movimientos/${movimientoId}/edicion`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readJson)
      .then((data: Movement) => {
        setMovement(data);
        setInitialMovement(data);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "No se pudo cargar el movimiento.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [movimientoId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movement || !initialMovement || saving || !editable) return;
    const original = editFields(initialMovement);
    const payload = Object.fromEntries(
      Object.entries(editFields(movement)).filter(
        ([key, value]) => value !== original[key as keyof typeof original],
      ),
    );
    if (
      "locomotiveNumber" in payload &&
      (!Number.isSafeInteger(movement.locomotiveNumber) || movement.locomotiveNumber <= 0)
    ) {
      setError("Indica un número de locomotora válido.");
      return;
    }
    for (const side of ["Origen", "Destino"] as const) {
      const viaKey = `via${side}Id` as const;
      const sectionKey = `seccion${side}Id` as const;
      if (viaKey in payload) {
        if (!vias.some((via) => via.id === movement[viaKey])) {
          setError(`Selecciona una vía de ${side.toLowerCase()} del catálogo de Torreón.`);
          return;
        }
        payload[sectionKey] = movement[sectionKey] || null;
      }
      if (
        sectionKey in payload &&
        movement[sectionKey] &&
        !(sections[movement[viaKey] ?? 0] ?? []).some(
          (section) => section.id === movement[sectionKey],
        )
      ) {
        setError(`Selecciona una sección de ${side.toLowerCase()} de la vía elegida.`);
        return;
      }
    }
    if (
      ["tipoMovimiento", "locomotoraRemolque", "direccionEmpuje", "locomotiveNumber"].some(
        (key) => key in payload,
      ) &&
      movement.tipoMovimiento === "REMOLCADA"
    ) {
      if (
        !Number.isSafeInteger(movement.locomotoraRemolque) ||
        Number(movement.locomotoraRemolque) <= 0 ||
        movement.locomotoraRemolque === movement.locomotiveNumber
      ) {
        setError("Indica otra locomotora que remolca, distinta a la solicitada.");
        return;
      }
      if (!["EMPUJAR", "JALAR"].includes(movement.direccionEmpuje ?? "")) {
        setError("Selecciona Empujar o Jalar para el movimiento remolcado.");
        return;
      }
    }
    for (const side of ["Origen", "Destino"] as const) {
      const key = `polo${side}`;
      if (key in payload && !["NORTE", "CENTRO", "SUR"].includes(String(payload[key]))) {
        setError(`Selecciona el polo de ${side === "Origen" ? "salida" : "llegada"}.`);
        return;
      }
    }
    for (const side of ["Origen", "Destino"] as const) {
      if (
        [`polo${side}`, `via${side}Id`, `seccion${side}Id`].some((key) => key in payload) &&
        movement[`polo${side}`] === "CENTRO" &&
        !movement[`seccion${side}Id`]
      ) {
        setError(`Selecciona la sección de ${side.toLowerCase()} para el polo Centro.`);
        return;
      }
    }
    if (!Object.keys(payload).length) {
      setError("No hay cambios para guardar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await readJson(
        await fetch(`/api/cliente/torreon/movimientos/${movimientoId}/edicion`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      router.push(backHref);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  const backHref = movement?.localidadId
    ? `/cliente/movimientos?loc=${movement.localidadId}`
    : "/cliente/movimientos";
  const editable = Boolean(
    movement &&
    ["SOLICITADO", "ASIGNADO"].includes(movement.estado) &&
    !movement.fechaInicio &&
    !movement.unidad?.fechaInicio &&
    (!movement.unidad || movement.unidad.estado === "PENDIENTE"),
  );
  return (
    <div className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 dark:text-slate-300"
      >
        <ArrowLeft size={16} /> Volver a movimientos
      </Link>
      <header className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <span className="rounded-xl bg-emerald-100 p-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <TrainFront size={24} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Torreón · Movimiento natural
          </p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
            Editar movimiento #{movimientoId}
          </h1>
        </div>
      </header>
      {loading && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950">
          Cargando movimiento…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {movement && (
        <form
          onSubmit={save}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Estado: <strong>{movement.estado}</strong>
            </span>
            {!editable && (
              <span className="text-sm text-amber-700 dark:text-amber-300">
                El movimiento ya inició y es de solo lectura.
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Locomotora
              <input
                className={field}
                type="number"
                min="1"
                required
                disabled={!editable || saving}
                value={movement.locomotiveNumber ?? ""}
                onChange={(e) =>
                  setMovement({ ...movement, locomotiveNumber: Number(e.target.value) })
                }
              />
            </label>
            <label className={label}>
              Prioridad
              <select
                className={field}
                disabled={!editable || saving}
                value={movement.prioridad}
                onChange={(e) =>
                  setMovement({ ...movement, prioridad: e.target.value as Movement["prioridad"] })
                }
              >
                <option value="BAJA">Normal</option>
                <option value="ALTA">Alta</option>
              </select>
            </label>
            <label className={label}>
              Tipo de movimiento
              <select
                className={field}
                disabled={!editable || saving}
                value={movement.tipoMovimiento || "MD_TRABAJANDO"}
                onChange={(e) =>
                  setMovement({
                    ...movement,
                    tipoMovimiento: e.target.value as Movement["tipoMovimiento"],
                  })
                }
              >
                <option value="MD_TRABAJANDO">Por sus medios</option>
                <option value="REMOLCADA">Remolcada</option>
              </select>
            </label>
            {movement.tipoMovimiento === "REMOLCADA" && (
              <label className={label}>
                Locomotora que remolca
                <input
                  className={field}
                  type="number"
                  min="1"
                  disabled={!editable || saving}
                  value={movement.locomotoraRemolque ?? ""}
                  onChange={(event) =>
                    setMovement({
                      ...movement,
                      locomotoraRemolque: Number(event.target.value) || null,
                    })
                  }
                />
              </label>
            )}
            {movement.tipoMovimiento === "REMOLCADA" && (
              <label className={label}>
                Dirección de empuje
                <select
                  className={field}
                  disabled={!editable || saving}
                  value={movement.direccionEmpuje || "Sin_Solicitar"}
                  onChange={(e) =>
                    setMovement({
                      ...movement,
                      direccionEmpuje: e.target.value as Movement["direccionEmpuje"],
                    })
                  }
                >
                  <option value="Sin_Solicitar">Sin solicitar</option>
                  <option value="EMPUJAR">Empujar</option>
                  <option value="JALAR">Jalar</option>
                </select>
              </label>
            )}
          </div>
          <label className={label}>
            Instrucciones
            <textarea
              className={`${field} min-h-28 resize-y`}
              maxLength={2000}
              disabled={!editable || saving}
              value={movement.instrucciones || ""}
              onChange={(e) => setMovement({ ...movement, instrucciones: e.target.value })}
            />
          </label>
          <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Recorrido y polos
            </legend>
            {viasError && (
              <div role="alert" className="mb-3 text-sm text-amber-700">
                <p>{viasError}</p>
                <button
                  type="button"
                  onClick={() => setCatalogRetry((count) => count + 1)}
                  disabled={saving}
                  className="underline"
                >
                  Reintentar vías
                </button>
              </div>
            )}
            {viasLoading && (
              <p role="status" className="text-sm">
                Cargando vías de Torreón…
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              {(["Origen", "Destino"] as const).map((side) => (
                <div key={side} className="min-w-0 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {side === "Origen" ? "Origen · De dónde se saca" : "Destino · Dónde se coloca"}
                  </p>
                  <label className={`${label} mt-4`}>
                    Vía de {side.toLowerCase()}
                    <select
                      className={field}
                      value={movement[`via${side}Id`] ?? ""}
                      disabled={!editable || saving || viasLoading || !vias.length}
                      onChange={(event) =>
                        setMovement({
                          ...movement,
                          [`via${side}Id`]: Number(event.target.value) || null,
                          [`seccion${side}Id`]: null,
                          [`seccion${side}Numero`]: null,
                          [`seccion${side}NombreSnapshot`]: null,
                        })
                      }
                    >
                      <option value="">Seleccionar vía</option>
                      {movement[`via${side}Id`] &&
                        !vias.some((via) => via.id === movement[`via${side}Id`]) && (
                          <option value={movement[`via${side}Id`] ?? ""}>
                            {movement[`via${side}NombreSnapshot`] ||
                              `Vía #${movement[`via${side}Id`]}`}
                          </option>
                        )}
                      {vias.map((via) => (
                        <option key={via.id} value={via.id}>
                          {via.nombre}
                        </option>
                      ))}
                    </select>
                    {!movement[`via${side}Id`] && movement[`via${side}NombreSnapshot`] && (
                      <span className="mt-1 block text-xs font-normal">
                        {movement[`via${side}NombreSnapshot`]}
                      </span>
                    )}
                  </label>
                  <label className={`${label} mt-4`}>
                    Polo de {side === "Origen" ? "salida" : "llegada"}
                    <select
                      className={field}
                      disabled={!editable || saving}
                      value={movement[`polo${side}`] || ""}
                      onChange={(e) =>
                        setMovement({ ...movement, [`polo${side}`]: e.target.value || null })
                      }
                    >
                      <option value="">No registrado</option>
                      <option value="NORTE">Norte</option>
                      <option value="CENTRO">Centro</option>
                      <option value="SUR">Sur</option>
                    </select>
                  </label>
                  <label className={`${label} mt-4`}>
                    Sección de {side.toLowerCase()}
                    <select
                      className={field}
                      aria-label={`Sección de ${side.toLowerCase()}`}
                      aria-required={movement[`polo${side}`] === "CENTRO"}
                      disabled={!editable || saving || !movement[`via${side}Id`]}
                      value={movement[`seccion${side}Id`] ?? ""}
                      onChange={(e) =>
                        setMovement({
                          ...movement,
                          [`seccion${side}Id`]: Number(e.target.value) || null,
                        })
                      }
                    >
                      <option value="">
                        {movement[`polo${side}`] === "CENTRO"
                          ? "Seleccionar sección (obligatoria)"
                          : "Sin sección · Opcional"}
                      </option>
                      {movement[`seccion${side}Id`] &&
                        !(sections[movement[`via${side}Id`] ?? 0] ?? []).some(
                          (section) => section.id === movement[`seccion${side}Id`],
                        ) && (
                          <option value={movement[`seccion${side}Id`] ?? ""}>
                            {sectionPositionLabel(
                              movement[`seccion${side}Numero`],
                              movement[`seccion${side}NombreSnapshot`],
                              true,
                            )}
                          </option>
                        )}
                      {(sections[movement[`via${side}Id`] ?? 0] ?? []).map((section) => (
                        <option key={section.id} value={section.id}>
                          {sectionPositionLabel(section.numero, section.nombre, true)}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {movement[`polo${side}`] === "CENTRO"
                        ? "Centro requiere una sección de esta vía."
                        : "Sección opcional para Norte y Sur."}
                    </span>
                  </label>
                  {sectionErrors[movement[`via${side}Id`] ?? 0] && (
                    <div className="mt-2 text-xs text-amber-700">
                      <p>{sectionErrors[movement[`via${side}Id`] ?? 0]}</p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void loadSections(Number(movement[`via${side}Id`]))}
                        className="mt-1 underline"
                      >
                        Reintentar secciones de {side.toLowerCase()}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </fieldset>
          {editable && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                <Save size={17} />
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
