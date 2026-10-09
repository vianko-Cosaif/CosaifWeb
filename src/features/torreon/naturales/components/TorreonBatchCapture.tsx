"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Info,
  MapPin,
  Plus,
  Send,
  TrainFront,
  Trash2,
} from "lucide-react";
import { configurationLabel } from "../queueView";
import s from "./batchCapture.module.scss";
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
  const prefix = useId();
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
        return prefix + "selecciona el polo de patio o la posición de chimenea.";
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
  const sectionLabel = (r: Row, side: "Origen" | "Destino") => {
    const section = sectionsByVia[Number(r[`via${side}Id`])]?.find(
      (item) => item.id === Number(r[`seccion${side}Id`]),
    );
    return section ? section.nombre || `Sección ${section.numero}` : "Sin posición específica";
  };
  const select = (
    r: Row,
    n: number,
    name: keyof Row,
    label: string,
    options: { value: string; label: string }[],
    hint?: string,
    disabled = false,
  ) => {
    const id = `${prefix}-${n}-${name}`;
    return (
      <div className={s.fieldGroup}>
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          disabled={busy || disabled}
          className={s.field}
          value={r[name]}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => update(n, name, e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hint && (
          <small id={`${id}-hint`} className={s.fieldHint}>
            {hint}
          </small>
        )}
      </div>
    );
  };
  return (
    <section className={s.capture} aria-labelledby="torreon-capture-title" aria-busy={busy}>
      <header className={s.header}>
        <div className={s.heading}>
          <span className={s.headingIcon}>
            <TrainFront size={24} aria-hidden />
          </span>
          <div>
            <span className={s.eyebrow}>MOVIMIENTOS NATURALES · TORREÓN</span>
            <h1 id="torreon-capture-title">Solicitar movimientos</h1>
            <p>Indica qué locomotora se mueve y dónde debe quedar.</p>
          </div>
        </div>
        <div className={s.counter}>
          <strong>
            {rows.length}
            <span> / 5</span>
          </strong>
          <span>{rows.length === 1 ? "solicitud en este envío" : "solicitudes en este envío"}</span>
        </div>
      </header>
      <ol className={s.steps} aria-label="Pasos de la solicitud">
        <li
          data-active={!review}
          data-complete={review}
          aria-current={!review ? "step" : undefined}
        >
          <span>{review ? <Check size={15} aria-hidden /> : "1"}</span>
          Capturar datos
        </li>
        <li className={s.stepLine} aria-hidden role="presentation" />
        <li data-active={review} aria-current={review ? "step" : undefined}>
          <span>2</span> Revisar y enviar
        </li>
      </ol>
      <div className={s.notice}>
        <Info size={18} aria-hidden />
        <p>
          Puedes registrar de 1 a 5 solicitudes. Cada una se atenderá por separado; coordinación o
          supervisión puede reunirlas después.
        </p>
      </div>
      {review && (
        <div className={s.reviewIntro}>
          <ClipboardCheck size={20} aria-hidden />
          <div>
            <strong>Revisa tu envío</strong>
            <p>Confirma locomotoras, origen, destino y orientación antes de enviar.</p>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      <div className={s.requests}>
        {rows.map((r, n) => (
          <article key={n} className={s.request} aria-labelledby={`${prefix}-${n}-title`}>
            <header className={s.requestHeader}>
              <div>
                <span className={s.requestNumber}>{String(n + 1).padStart(2, "0")}</span>
                <h2 id={`${prefix}-${n}-title`}>
                  Solicitud {n + 1}
                  {review ? ` · Locomotora ${r.locomotiveNumber}` : ""}
                </h2>
              </div>
              {!review && rows.length > 1 && (
                <button
                  type="button"
                  className={s.removeButton}
                  disabled={busy}
                  aria-label={`Quitar solicitud ${n + 1}`}
                  onClick={() => {
                    key.current = "";
                    setRows((prev) => prev.filter((_, i) => i !== n));
                  }}
                >
                  <Trash2 size={14} aria-hidden /> Quitar
                </button>
              )}
              {review && <span className={s.independentTag}>Solicitud independiente</span>}
            </header>
            {review ? (
              <div className={s.requestBody}>
                <div className={s.reviewRoute}>
                  {(["Origen", "Destino"] as const).map((side) => (
                    <div key={side} className={s.reviewStop}>
                      <span>
                        <MapPin size={14} aria-hidden />
                        {side === "Origen" ? "De dónde se saca" : "Dónde se va a colocar"}
                      </span>
                      <strong>
                        {vias.find((v) => v.id === Number(r[`via${side}Id`]))?.nombre}
                      </strong>
                      <small>{sectionLabel(r, side)}</small>
                    </div>
                  ))}
                  <ArrowRight size={20} className={s.reviewArrow} aria-hidden />
                </div>
                <dl className={s.reviewData}>
                  <div>
                    <dt>Tipo de movimiento</dt>
                    <dd>{configurationLabel(r.tipoMovimiento)}</dd>
                  </div>
                  <div>
                    <dt>Polo de patio</dt>
                    <dd>{configurationLabel(r.polo)}</dd>
                  </div>
                  <div>
                    <dt>Posición de chimenea</dt>
                    <dd>{configurationLabel(r.posicionChimenea)}</dd>
                  </div>
                  <div>
                    <dt>Posición de cabina</dt>
                    <dd>{configurationLabel(r.posicionCabina)}</dd>
                  </div>
                </dl>
                {r.tipoMovimiento === "REMOLCADA" && (
                  <p className={s.reviewTowing}>
                    Remolca: {r.locomotoraRemolque} · {configurationLabel(r.direccionEmpuje)}
                  </p>
                )}
                {r.instrucciones && (
                  <div className={s.reviewInstructions}>
                    <strong>Indicaciones adicionales</strong>
                    <p>{r.instrucciones}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className={s.requestBody}>
                <fieldset className={s.group}>
                  <legend>
                    <TrainFront size={16} aria-hidden /> Locomotora y movimiento
                  </legend>
                  <div className={s.twoColumns}>
                    <label className={s.fieldGroup}>
                      Locomotora solicitada
                      <input
                        disabled={busy}
                        className={s.field}
                        inputMode="numeric"
                        placeholder="Ej. 12345"
                        value={r.locomotiveNumber}
                        onChange={(e) => update(n, "locomotiveNumber", e.target.value)}
                      />
                    </label>
                    {select(r, n, "tipoMovimiento", "Tipo de movimiento", [
                      { value: "MD_TRABAJANDO", label: "MD trabajando" },
                      { value: "REMOLCADA", label: "Remolcada" },
                    ])}
                  </div>
                  {r.tipoMovimiento === "REMOLCADA" && (
                    <div className={s.towingFields}>
                      <p>La locomotora que remolca debe ser distinta a la solicitada.</p>
                      <div className={s.twoColumns}>
                        <label className={s.fieldGroup}>
                          Locomotora que remolca
                          <input
                            disabled={busy}
                            className={s.field}
                            inputMode="numeric"
                            placeholder="Número de la locomotora de apoyo"
                            value={r.locomotoraRemolque}
                            onChange={(e) => update(n, "locomotoraRemolque", e.target.value)}
                          />
                        </label>
                        {select(r, n, "direccionEmpuje", "Dirección", [
                          { value: "Sin_Solicitar", label: "Seleccionar dirección" },
                          { value: "EMPUJAR", label: "Empujar" },
                          { value: "JALAR", label: "Jalar" },
                        ])}
                      </div>
                    </div>
                  )}
                </fieldset>
                <fieldset className={s.group}>
                  <legend>
                    <MapPin size={16} aria-hidden /> Recorrido del movimiento
                  </legend>
                  <div className={s.routeFields}>
                    {(["Origen", "Destino"] as const).map((side) => {
                      const sections = sectionsByVia[Number(r[`via${side}Id`])] ?? [];
                      const hasVia = Boolean(r[`via${side}Id`]);
                      return (
                        <div key={side} className={s.routeCard}>
                          <header>
                            <span className={s.routeDot} data-destination={side === "Destino"} />
                            <div>
                              <h3>{side}</h3>
                              <p>
                                {side === "Origen" ? "De dónde se saca" : "Dónde se va a colocar"}
                              </p>
                            </div>
                          </header>
                          {select(r, n, `via${side}Id`, `Vía de ${side.toLowerCase()}`, [
                            { value: "", label: "Seleccionar vía" },
                            ...vias.map((v) => ({ value: String(v.id), label: v.nombre })),
                          ])}
                          {select(
                            r,
                            n,
                            `seccion${side}Id`,
                            `Posición de ${side.toLowerCase()}`,
                            [
                              {
                                value: "",
                                label: !hasVia
                                  ? "Primero selecciona una vía"
                                  : sections.length
                                    ? "Seleccionar posición"
                                    : "Sin posiciones registradas",
                              },
                              ...sections.map((section) => ({
                                value: String(section.id),
                                label: section.nombre || `Sección ${section.numero}`,
                              })),
                            ],
                            hasVia && !sections.length
                              ? "Esta vía no tiene secciones registradas."
                              : "Selecciona la sección dentro de la vía.",
                            !hasVia || !sections.length,
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className={s.group}>
                  <legend>Orientación en patio</legend>
                  <p className={s.groupHint}>
                    Completa el polo de patio o la posición de chimenea.
                  </p>
                  <div className={s.threeColumns}>
                    {select(
                      r,
                      n,
                      "polo",
                      "Polo de patio",
                      ["Sin_Solicitar", "NORTE", "SUR"].map((value) => ({
                        value,
                        label: configurationLabel(value),
                      })),
                    )}
                    {(["posicionChimenea", "posicionCabina"] as const).map((name) => (
                      <div key={name}>
                        {select(
                          r,
                          n,
                          name,
                          name === "posicionCabina" ? "Posición de cabina" : "Posición de chimenea",
                          ["Sin_Solicitar", "DENTRO", "AFUERA"].map((value) => ({
                            value,
                            label: configurationLabel(value),
                          })),
                        )}
                      </div>
                    ))}
                  </div>
                </fieldset>
                <label className={s.fieldGroup}>
                  Indicaciones adicionales
                  <textarea
                    disabled={busy}
                    className={s.field}
                    rows={3}
                    placeholder="Agrega instrucciones que coordinación deba conocer (opcional)."
                    value={r.instrucciones}
                    onChange={(e) => update(n, "instrucciones", e.target.value)}
                    maxLength={2000}
                  />
                </label>
              </div>
            )}
          </article>
        ))}
      </div>
      {!review && (
        <button
          type="button"
          className={s.addButton}
          disabled={busy || rows.length >= 5}
          onClick={() => {
            key.current = "";
            setRows((prev) => [...prev, empty()]);
          }}
        >
          <Plus size={17} aria-hidden /> Agregar solicitud ({rows.length}/5)
        </button>
      )}
      <footer className={s.footer}>
        <span>
          {rows.length}{" "}
          {rows.length === 1 ? "solicitud independiente" : "solicitudes independientes"} en este
          envío
        </span>
        <div className={s.footerActions}>
          <button type="button" className={s.cancelButton} disabled={busy} onClick={onCancel}>
            Salir
          </button>
          {review ? (
            <>
              <button
                type="button"
                className={s.button}
                disabled={busy}
                onClick={() => setReview(false)}
              >
                Editar datos
              </button>
              <button
                type="button"
                className={s.primaryButton}
                disabled={busy}
                onClick={() => void send()}
              >
                <Send size={16} aria-hidden />
                {busy
                  ? "Enviando…"
                  : `Enviar ${rows.length} ${rows.length === 1 ? "solicitud" : "solicitudes"}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={s.primaryButton}
              disabled={busy}
              onClick={() => {
                const issue = validate();
                setError(issue);
                if (!issue) setReview(true);
              }}
            >
              Revisar envío <ArrowRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
