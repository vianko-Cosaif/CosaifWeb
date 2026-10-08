"use client";
import { useEffect, useRef, useState } from "react";
type Row = {
  locomotiveNumber: string;
  viaOrigenId: string;
  viaDestinoId: string;
  seccionOrigenId: string;
  seccionDestinoId: string;
  polo: string;
  posicionChimenea: string;
  posicionCabina: string;
  tipoMovimiento: string;
  direccionEmpuje: string;
  locomotoraRemolque: string;
  instrucciones: string;
};
const empty = (): Row => ({
  locomotiveNumber: "",
  viaOrigenId: "",
  viaDestinoId: "",
  seccionOrigenId: "",
  seccionDestinoId: "",
  polo: "Sin_Solicitar",
  posicionChimenea: "Sin_Solicitar",
  posicionCabina: "Sin_Solicitar",
  tipoMovimiento: "MD_TRABAJANDO",
  direccionEmpuje: "Sin_Solicitar",
  locomotoraRemolque: "",
  instrucciones: "",
});
type Props = {
  initialMovement?: Partial<Row>;
  localidadId: number;
  empresaId: number | null;
  creadoPorId: number | null;
  vias: { id: number; nombre: string }[];
  sectionsByVia: Record<number, { id: number; numero: number; nombre?: string | null }[]>;
  ensureSections: (id: number) => unknown;
  onFinish: () => void;
  onCancel: () => void;
};
const field =
  "w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
export default function TorreonBatchCapture({
  initialMovement,
  localidadId,
  empresaId,
  creadoPorId,
  vias,
  sectionsByVia,
  ensureSections,
  onFinish,
  onCancel,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => [{ ...empty(), ...initialMovement }]);
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef<string>("");
  useEffect(() => {
    for (const id of [initialMovement?.viaOrigenId, initialMovement?.viaDestinoId])
      if (id) void ensureSections(Number(id));
  }, [ensureSections, initialMovement?.viaOrigenId, initialMovement?.viaDestinoId]);
  const update = (index: number, name: keyof Row, value: string) => {
    key.current = "";
    setRows((prev) =>
      prev.map((r, n) =>
        n === index
          ? {
              ...r,
              [name]: value,
              ...(name === "viaOrigenId"
                ? { seccionOrigenId: "" }
                : name === "viaDestinoId"
                  ? { seccionDestinoId: "" }
                  : {}),
            }
          : r,
      ),
    );
    if (name === "viaOrigenId" || name === "viaDestinoId") void ensureSections(Number(value));
  };
  const validate = () => {
    if (!empresaId || !creadoPorId) return "Completa empresa y sesión antes de enviar.";
    for (let n = 0; n < rows.length; n++) {
      const r = rows[n],
        prefix = `Solicitud ${n + 1}: `;
      if (
        !/^\d+$/.test(r.locomotiveNumber) ||
        Number(r.locomotiveNumber) <= 0 ||
        !r.viaOrigenId ||
        !r.viaDestinoId
      )
        return prefix + "completa locomotora, origen y destino.";
      if (r.polo === "Sin_Solicitar" && r.posicionChimenea === "Sin_Solicitar")
        return prefix + "selecciona polo o posición de chimenea.";
      for (const side of ["Origen", "Destino"] as const) {
        if ((sectionsByVia[Number(r[`via${side}Id`])]?.length ?? 0) > 0 && !r[`seccion${side}Id`])
          return prefix + `selecciona la sección de ${side.toLowerCase()}.`;
      }
      if (
        r.tipoMovimiento === "REMOLCADA" &&
        (!/^\d+$/.test(r.locomotoraRemolque) ||
          Number(r.locomotoraRemolque) <= 0 ||
          Number(r.locomotoraRemolque) === Number(r.locomotiveNumber) ||
          r.direccionEmpuje === "Sin_Solicitar")
      )
        return prefix + "indica otra locomotora que remolca y Empujar/Jalar.";
    }
    return "";
  };
  const send = async () => {
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    setError("");
    key.current ||= crypto.randomUUID();
    try {
      const movements = rows.map((r) => ({
        ...r,
        instrucciones: r.instrucciones.trim() || undefined,
        locomotiveNumber: Number(r.locomotiveNumber),
        viaOrigenId: Number(r.viaOrigenId),
        viaDestinoId: Number(r.viaDestinoId),
        seccionOrigenId: r.seccionOrigenId ? Number(r.seccionOrigenId) : undefined,
        seccionDestinoId: r.seccionDestinoId ? Number(r.seccionDestinoId) : undefined,
        locomotoraRemolque:
          r.tipoMovimiento === "REMOLCADA" ? Number(r.locomotoraRemolque) : undefined,
        direccionEmpuje: r.tipoMovimiento === "REMOLCADA" ? r.direccionEmpuje : "Sin_Solicitar",
        localidadId,
        empresaId,
        creadoPorId,
        viaOrigenNombreSnapshot: vias.find((v) => v.id === Number(r.viaOrigenId))?.nombre,
        viaDestinoNombreSnapshot: vias.find((v) => v.id === Number(r.viaDestinoId))?.nombre,
        seccionOrigenNombreSnapshot:
          sectionsByVia[Number(r.viaOrigenId)]?.find((s) => s.id === Number(r.seccionOrigenId))
            ?.nombre ??
          (r.seccionOrigenId
            ? `Sección ${sectionsByVia[Number(r.viaOrigenId)]?.find((s) => s.id === Number(r.seccionOrigenId))?.numero}`
            : undefined),
        seccionDestinoNombreSnapshot:
          sectionsByVia[Number(r.viaDestinoId)]?.find((s) => s.id === Number(r.seccionDestinoId))
            ?.nombre ??
          (r.seccionDestinoId
            ? `Sección ${sectionsByVia[Number(r.viaDestinoId)]?.find((s) => s.id === Number(r.seccionDestinoId))?.numero}`
            : undefined),
      }));
      const response = await fetch("/bff/torreon/movimientos/lote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientRequestId: key.current, movimientos: movements }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message ?? data.error ?? "No se pudo registrar el envío");
      onFinish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  };
  const select = (
    r: Row,
    n: number,
    name: keyof Row,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <label className="text-sm">
      {label}
      <select
        disabled={busy}
        className={field}
        value={r[name]}
        onChange={(e) => update(n, name, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="mx-auto max-w-5xl space-y-4 p-4 text-slate-900 dark:text-white">
      <h1 className="text-2xl font-bold">Solicitar movimientos · Torreón</h1>
      <p>
        De 1 a 5 solicitudes independientes. La atención conjunta la registra coordinación o
        supervisión.
      </p>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {rows.map((r, n) => (
        <article
          key={n}
          className="space-y-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700"
        >
          <div className="flex justify-between">
            <h2 className="font-bold">
              Solicitud {n + 1}
              {review ? ` · Locomotora ${r.locomotiveNumber}` : ""}
            </h2>
            {!review && rows.length > 1 && (
              <button
                disabled={busy}
                onClick={() => {
                  key.current = "";
                  setRows((prev) => prev.filter((_, i) => i !== n));
                }}
              >
                Quitar
              </button>
            )}
          </div>
          {review ? (
            <div>
              <p>
                {vias.find((v) => v.id === Number(r.viaOrigenId))?.nombre}{" "}
                {r.seccionOrigenId
                  ? `· Sección ${sectionsByVia[Number(r.viaOrigenId)]?.find((s) => s.id === Number(r.seccionOrigenId))?.numero}`
                  : ""}{" "}
                → {vias.find((v) => v.id === Number(r.viaDestinoId))?.nombre}{" "}
                {r.seccionDestinoId
                  ? `· Sección ${sectionsByVia[Number(r.viaDestinoId)]?.find((s) => s.id === Number(r.seccionDestinoId))?.numero}`
                  : ""}
              </p>
              <p>
                Polo: {r.polo} · Chimenea: {r.posicionChimenea} · Cabina: {r.posicionCabina} ·{" "}
                {r.tipoMovimiento}
              </p>
              {r.tipoMovimiento === "REMOLCADA" && (
                <p>
                  Remolca: {r.locomotoraRemolque} · {r.direccionEmpuje}
                </p>
              )}
              {r.instrucciones && <p>Indicaciones: {r.instrucciones}</p>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">
                Locomotora solicitada
                <input
                  disabled={busy}
                  className={field}
                  inputMode="numeric"
                  value={r.locomotiveNumber}
                  onChange={(e) => update(n, "locomotiveNumber", e.target.value)}
                />
              </label>
              {(["Origen", "Destino"] as const).map((side) => (
                <div key={side} className="space-y-2">
                  {select(r, n, `via${side}Id`, `Vía de ${side.toLowerCase()}`, [
                    { value: "", label: "Seleccionar vía" },
                    ...vias.map((v) => ({ value: String(v.id), label: v.nombre })),
                  ])}
                  {select(r, n, `seccion${side}Id`, `Sección de ${side.toLowerCase()}`, [
                    { value: "", label: "Seleccionar sección si corresponde" },
                    ...(sectionsByVia[Number(r[`via${side}Id`])] ?? []).map((s) => ({
                      value: String(s.id),
                      label: s.nombre ?? `Sección ${s.numero}`,
                    })),
                  ])}
                </div>
              ))}
              {select(
                r,
                n,
                "polo",
                "Polo",
                ["Sin_Solicitar", "NORTE", "SUR"].map((value) => ({
                  value,
                  label: value.replace("_", " "),
                })),
              )}
              {(["posicionChimenea", "posicionCabina"] as const).map((name) => (
                <div key={name}>
                  {select(
                    r,
                    n,
                    name,
                    name === "posicionCabina" ? "Cabina" : "Chimenea",
                    ["Sin_Solicitar", "DENTRO", "AFUERA"].map((value) => ({
                      value,
                      label: value.replace("_", " "),
                    })),
                  )}
                </div>
              ))}
              {select(r, n, "tipoMovimiento", "Tipo de movimiento", [
                { value: "MD_TRABAJANDO", label: "MD Trabajando" },
                { value: "REMOLCADA", label: "Remolcada" },
              ])}
              {r.tipoMovimiento === "REMOLCADA" && (
                <>
                  <label className="text-sm">
                    Locomotora que remolca
                    <input
                      disabled={busy}
                      className={field}
                      inputMode="numeric"
                      value={r.locomotoraRemolque}
                      onChange={(e) => update(n, "locomotoraRemolque", e.target.value)}
                    />
                  </label>
                  {select(r, n, "direccionEmpuje", "Dirección", [
                    { value: "Sin_Solicitar", label: "Seleccionar" },
                    { value: "EMPUJAR", label: "Empujar" },
                    { value: "JALAR", label: "Jalar" },
                  ])}
                </>
              )}
              <label className="text-sm">
                Indicaciones adicionales
                <textarea
                  disabled={busy}
                  className={field}
                  value={r.instrucciones}
                  onChange={(e) => update(n, "instrucciones", e.target.value)}
                  maxLength={2000}
                />
              </label>
            </div>
          )}
        </article>
      ))}
      <div className="flex flex-wrap gap-3">
        {!review && (
          <>
            <button
              className={field + " !w-auto"}
              disabled={busy || rows.length >= 5}
              onClick={() => {
                key.current = "";
                setRows((prev) => [...prev, empty()]);
              }}
            >
              Agregar solicitud ({rows.length}/5)
            </button>
            <button
              className={field + " !w-auto"}
              onClick={() => {
                const issue = validate();
                setError(issue);
                if (!issue) setReview(true);
              }}
            >
              Revisar envío
            </button>
          </>
        )}
        {review && (
          <>
            <button className={field + " !w-auto"} disabled={busy} onClick={() => setReview(false)}>
              Editar datos
            </button>
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? "Enviando…" : `Enviar ${rows.length} solicitudes`}
            </button>
          </>
        )}
        <button disabled={busy} onClick={onCancel}>
          Salir
        </button>
      </div>
    </section>
  );
}
