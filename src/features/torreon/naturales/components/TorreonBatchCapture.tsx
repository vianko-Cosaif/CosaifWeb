"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Info,
  MapPin,
  Plus,
  Send,
  TrainFront,
  Trash2,
} from "lucide-react";
import { configurationLabel, poleLabel, sectionPositionLabel } from "../queueView";
import s from "./batchCapture.module.scss";
type Row = {
  locomotiveNumber: string;
  viaOrigenId: string;
  viaDestinoId: string;
  seccionOrigenId: string;
  seccionDestinoId: string;
  poloOrigen: string;
  poloDestino: string;
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
  poloOrigen: "",
  poloDestino: "",
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
  sectionsError?: Record<number, string>;
  viasLoading?: boolean;
  viasError?: string | null;
  onRetryVias?: () => void;
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
  sectionsError = {},
  viasLoading = false,
  viasError,
  onRetryVias,
  onFinish,
  onCancel,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => [{ ...empty(), ...initialMovement }]);
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [fieldIssue, setFieldIssue] = useState<{
    index: number;
    field: keyof Row;
    message: string;
  } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const key = useRef<string>("");
  const prefix = useId();
  useEffect(() => {
    if (!focusRequest) return;
    const field = document.getElementById(focusRequest.id);
    field?.focus({ preventScroll: true });
    field?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [focusRequest]);
  useEffect(() => {
    for (const id of [initialMovement?.viaOrigenId, initialMovement?.viaDestinoId])
      if (id) void ensureSections(Number(id));
  }, [ensureSections, initialMovement?.viaOrigenId, initialMovement?.viaDestinoId]);
  const update = (index: number, name: keyof Row, value: string) => {
    key.current = "";
    setError("");
    setFieldIssue(null);
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
  const rowIssue = (r: Row): { field: keyof Row; message: string } | null => {
    if (!/^\d+$/.test(r.locomotiveNumber) || Number(r.locomotiveNumber) <= 0)
      return {
        field: "locomotiveNumber",
        message: "indica el número de la locomotora solicitada.",
      };
    for (const side of ["Origen", "Destino"] as const) {
      const via = Number(r[`via${side}Id`]);
      if (!via || !vias.some((item) => item.id === via))
        return { field: `via${side}Id`, message: `selecciona la vía de ${side.toLowerCase()}.` };
      if (!["NORTE", "CENTRO", "SUR"].includes(r[`polo${side}`]))
        return {
          field: `polo${side}`,
          message: `selecciona el polo de ${side === "Origen" ? "salida" : "llegada"}.`,
        };
    }
    for (const side of ["Origen", "Destino"] as const) {
      const via = Number(r[`via${side}Id`]);
      const sectionId = r[`seccion${side}Id`];
      const required = r[`polo${side}`] === "CENTRO";
      if (!required && !sectionId) continue;
      if (sectionsError[via])
        return {
          field: `via${side}Id`,
          message: `reintenta la carga de posiciones de ${side.toLowerCase()}.`,
        };
      const sections = sectionsByVia[via];
      if (!Array.isArray(sections))
        return {
          field: `via${side}Id`,
          message: `espera a que carguen las posiciones de ${side.toLowerCase()}.`,
        };
      if (!sections.some((item) => item.id === Number(sectionId)))
        return {
          field: `seccion${side}Id`,
          message: required
            ? `selecciona la sección de ${side.toLowerCase()} para el polo Centro.`
            : `selecciona una sección válida de ${side.toLowerCase()} o deja el campo vacío.`,
        };
    }
    if (r.tipoMovimiento === "REMOLCADA") {
      if (
        !/^\d+$/.test(r.locomotoraRemolque) ||
        Number(r.locomotoraRemolque) <= 0 ||
        Number(r.locomotoraRemolque) === Number(r.locomotiveNumber)
      )
        return {
          field: "locomotoraRemolque",
          message: "indica otra locomotora que remolca, distinta a la solicitada.",
        };
      if (r.direccionEmpuje === "Sin_Solicitar")
        return { field: "direccionEmpuje", message: "selecciona Empujar o Jalar." };
    }
    return null;
  };
  const validate = () => {
    if (!empresaId || !creadoPorId) {
      setError("Completa empresa y sesión antes de enviar.");
      setFocusRequest({ id: `${prefix}-error` });
      return false;
    }
    for (let index = 0; index < rows.length; index++) {
      const issue = rowIssue(rows[index]);
      if (issue) {
        setFieldIssue({ ...issue, index });
        setError(`Solicitud ${index + 1}: ${issue.message}`);
        setActive(index);
        setReview(false);
        setFocusRequest({ id: `${prefix}-${index}-${issue.field}` });
        return false;
      }
    }
    setError("");
    setFieldIssue(null);
    return true;
  };
  const fieldMessage = (n: number, name: keyof Row) =>
    fieldIssue?.index === n && fieldIssue.field === name ? fieldIssue.message : "";
  const fieldAccessibility = (n: number, name: keyof Row, hint = false) => ({
    id: `${prefix}-${n}-${name}`,
    "aria-invalid": fieldMessage(n, name) ? true : undefined,
    "aria-describedby":
      [
        hint ? `${prefix}-${n}-${name}-hint` : "",
        fieldMessage(n, name) ? `${prefix}-${n}-${name}-error` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  });
  const inlineError = (n: number, name: keyof Row) =>
    fieldMessage(n, name) ? (
      <small id={`${prefix}-${n}-${name}-error`} className={s.fieldError}>
        {fieldMessage(n, name)}
      </small>
    ) : null;
  const send = async () => {
    if (!validate()) return;
    setBusy(true);
    setError("");
    key.current ||= crypto.randomUUID();
    try {
      const movements = rows.map((r) => ({
        poloOrigen: r.poloOrigen,
        poloDestino: r.poloDestino,
        tipoMovimiento: r.tipoMovimiento,
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
        seccionOrigenNombreSnapshot: r.seccionOrigenId ? sectionLabel(r, "Origen") : undefined,
        seccionDestinoNombreSnapshot: r.seccionDestinoId ? sectionLabel(r, "Destino") : undefined,
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
      setFocusRequest({ id: `${prefix}-error` });
    } finally {
      setBusy(false);
    }
  };
  const sectionLabel = (r: Row, side: "Origen" | "Destino") => {
    const section = sectionsByVia[Number(r[`via${side}Id`])]?.find(
      (item) => item.id === Number(r[`seccion${side}Id`]),
    );
    return section
      ? sectionPositionLabel(section.numero, section.nombre, true)
      : "Sin sección especificada";
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
          {...fieldAccessibility(n, name, Boolean(hint))}
          disabled={busy || disabled}
          aria-required={
            name === "seccionOrigenId"
              ? r.poloOrigen === "CENTRO"
              : name === "seccionDestinoId"
                ? r.poloDestino === "CENTRO"
                : undefined
          }
          className={s.field}
          value={r[name]}
          onChange={(e) => update(n, name, e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {inlineError(n, name)}
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
        <div id={`${prefix}-review`} tabIndex={-1} className={s.reviewIntro}>
          <ClipboardCheck size={20} aria-hidden />
          <div>
            <strong>Revisa tu envío</strong>
            <p>Confirma locomotoras, origen, destino y orientación antes de enviar.</p>
          </div>
        </div>
      )}
      {error && (
        <p id={`${prefix}-error`} tabIndex={-1} role="alert" className={s.error}>
          {error}
        </p>
      )}
      {!review && (
        <p className={s.formHint}>
          Completa una solicitud a la vez. Los campos opcionales están indicados.
        </p>
      )}
      {!review && (viasLoading || viasError || !vias.length) && (
        <div className={s.catalogNotice} role="status">
          <p>
            {viasLoading
              ? "Cargando vías de Torreón…"
              : viasError ||
                "No hay vías disponibles en Torreón. Solicita a coordinación revisar el catálogo."}
          </p>
          {!viasLoading && onRetryVias && (
            <button type="button" className={s.button} onClick={onRetryVias}>
              Reintentar carga de vías
            </button>
          )}
        </div>
      )}
      <div className={s.requests}>
        {rows.map((r, n) => (
          <article key={n} className={s.request} aria-labelledby={`${prefix}-${n}-title`}>
            <header className={s.requestHeader} data-expanded={review || active === n}>
              <span className={s.requestNumber}>{String(n + 1).padStart(2, "0")}</span>
              <div className={s.requestSummary}>
                {review ? (
                  <h2 id={`${prefix}-${n}-title`}>
                    Solicitud {n + 1} · Locomotora {r.locomotiveNumber}
                  </h2>
                ) : (
                  <h2 id={`${prefix}-${n}-title`}>
                    <button
                      type="button"
                      className={s.expandButton}
                      aria-label={`Editar solicitud ${n + 1}`}
                      aria-expanded={active === n}
                      aria-controls={`${prefix}-${n}-body`}
                      disabled={busy}
                      onClick={() => setActive((current) => (current === n ? -1 : n))}
                    >
                      <span>
                        <span className={s.requestTitle}>
                          Solicitud {n + 1}
                          {r.locomotiveNumber ? ` · Locomotora ${r.locomotiveNumber}` : ""}
                        </span>
                        <span className={s.requestSubtitle}>
                          {r.viaOrigenId || r.viaDestinoId
                            ? `${vias.find((v) => v.id === Number(r.viaOrigenId))?.nombre || "Elige origen"} → ${vias.find((v) => v.id === Number(r.viaDestinoId))?.nombre || "Elige destino"}`
                            : "Indica la locomotora y su recorrido"}
                        </span>
                      </span>
                      <ChevronDown
                        size={18}
                        aria-hidden
                        className={active === n ? s.chevronOpen : undefined}
                      />
                    </button>
                  </h2>
                )}
              </div>
              <div className={s.requestTools}>
                <span className={s.completionTag} data-complete={!rowIssue(r)}>
                  {!rowIssue(r) ? (
                    <>
                      <Check size={13} aria-hidden /> Completa
                    </>
                  ) : (
                    "Por completar"
                  )}
                </span>
                {!review && rows.length > 1 && (
                  <button
                    type="button"
                    className={s.removeButton}
                    disabled={busy}
                    aria-label={`Quitar solicitud ${n + 1}`}
                    onClick={() => {
                      key.current = "";
                      setRows((prev) => prev.filter((_, i) => i !== n));
                      setActive((current) =>
                        Math.max(0, current > n ? current - 1 : Math.min(current, rows.length - 2)),
                      );
                      setError("");
                      setFieldIssue(null);
                    }}
                  >
                    <Trash2 size={16} aria-hidden />
                    <span>Quitar</span>
                  </button>
                )}
              </div>
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
                      <span className={s.sectionBadge}>{sectionLabel(r, side)}</span>
                      <p className={s.poleLabel}>
                        Polo de {side === "Origen" ? "salida" : "llegada"}:{" "}
                        <strong>{poleLabel(r[`polo${side}`])}</strong>
                      </p>
                    </div>
                  ))}
                  <ArrowRight size={20} className={s.reviewArrow} aria-hidden />
                </div>
                <dl className={s.reviewData}>
                  <div>
                    <dt>Tipo de movimiento</dt>
                    <dd>{configurationLabel(r.tipoMovimiento)}</dd>
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
            ) : active === n ? (
              <div id={`${prefix}-${n}-body`} className={s.requestBody}>
                <fieldset className={s.group}>
                  <legend>
                    <TrainFront size={16} aria-hidden /> Locomotora y movimiento
                  </legend>
                  <div className={s.twoColumns}>
                    <div className={s.fieldGroup}>
                      <label htmlFor={`${prefix}-${n}-locomotiveNumber`}>
                        Locomotora solicitada
                      </label>
                      <input
                        {...fieldAccessibility(n, "locomotiveNumber")}
                        disabled={busy}
                        className={s.field}
                        inputMode="numeric"
                        placeholder="Ej. 12345"
                        value={r.locomotiveNumber}
                        onChange={(e) => update(n, "locomotiveNumber", e.target.value)}
                      />
                      {inlineError(n, "locomotiveNumber")}
                    </div>
                    {select(
                      r,
                      n,
                      "tipoMovimiento",
                      "Tipo de movimiento",
                      [
                        { value: "MD_TRABAJANDO", label: "MD trabajando" },
                        { value: "REMOLCADA", label: "Remolcada" },
                      ],
                      r.tipoMovimiento === "MD_TRABAJANDO"
                        ? "Se desplaza por sus propios medios."
                        : "Necesita otra locomotora para moverse.",
                    )}
                  </div>
                  {r.tipoMovimiento === "REMOLCADA" && (
                    <div className={s.towingFields}>
                      <p>La locomotora que remolca debe ser distinta a la solicitada.</p>
                      <div className={s.twoColumns}>
                        <div className={s.fieldGroup}>
                          <label htmlFor={`${prefix}-${n}-locomotoraRemolque`}>
                            Locomotora que remolca
                          </label>
                          <input
                            {...fieldAccessibility(n, "locomotoraRemolque")}
                            disabled={busy}
                            className={s.field}
                            inputMode="numeric"
                            placeholder="Número de la locomotora de apoyo"
                            value={r.locomotoraRemolque}
                            onChange={(e) => update(n, "locomotoraRemolque", e.target.value)}
                          />
                          {inlineError(n, "locomotoraRemolque")}
                        </div>
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
                      const sectionError = sectionsError[Number(r[`via${side}Id`])];
                      const loading =
                        hasVia &&
                        !sectionError &&
                        !Array.isArray(sectionsByVia[Number(r[`via${side}Id`])]);
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
                          {select(
                            r,
                            n,
                            `via${side}Id`,
                            `Vía de ${side.toLowerCase()}`,
                            [
                              { value: "", label: "Seleccionar vía" },
                              ...vias.map((v) => ({ value: String(v.id), label: v.nombre })),
                            ],
                            undefined,
                            viasLoading || Boolean(viasError),
                          )}
                          {select(
                            r,
                            n,
                            `polo${side}`,
                            `Polo de ${side === "Origen" ? "salida" : "llegada"}`,
                            [
                              { value: "", label: "Seleccionar polo" },
                              { value: "NORTE", label: "Norte" },
                              { value: "CENTRO", label: "Centro" },
                              { value: "SUR", label: "Sur" },
                            ],
                            side === "Origen"
                              ? "Desde qué polo sale la locomotora. Obligatorio."
                              : "En qué polo debe quedar la locomotora. Obligatorio.",
                          )}
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
                                  : sectionError
                                    ? "No se pudieron cargar"
                                    : loading
                                      ? "Cargando posiciones…"
                                      : sections.length
                                        ? r[`polo${side}`] === "CENTRO"
                                          ? "Seleccionar sección (obligatoria)"
                                          : "Sin sección · Opcional"
                                        : "Sin posiciones registradas",
                              },
                              ...sections.map((section) => ({
                                value: String(section.id),
                                label: sectionPositionLabel(section.numero, section.nombre, true),
                              })),
                            ],
                            sectionError
                              ? r[`polo${side}`] === "CENTRO" || r[`seccion${side}Id`]
                                ? "No pudimos consultar las posiciones. Reintenta para continuar."
                                : "Puedes continuar sin sección para Norte o Sur."
                              : loading
                                ? r[`polo${side}`] === "CENTRO"
                                  ? "Espera a que se cargue el catálogo de esta vía."
                                  : "La sección es opcional para Norte y Sur."
                                : hasVia && !sections.length
                                  ? r[`polo${side}`] === "CENTRO"
                                    ? "Registra secciones en esta vía para seleccionar Centro."
                                    : "Esta vía no tiene secciones registradas."
                                  : r[`polo${side}`] === "CENTRO"
                                    ? "Centro requiere una sección dentro de esta vía."
                                    : "Sección opcional para Norte y Sur.",
                            !hasVia || !sections.length || loading || Boolean(sectionError),
                          )}
                          {sectionError && (
                            <button
                              type="button"
                              className={s.retryButton}
                              onClick={() => {
                                setError("");
                                setFieldIssue(null);
                                void ensureSections(Number(r[`via${side}Id`]));
                              }}
                            >
                              Reintentar posiciones de {side.toLowerCase()}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
                <label className={s.fieldGroup}>
                  <span>
                    Indicaciones adicionales <span className={s.optional}>· Opcional</span>
                  </span>
                  <textarea
                    aria-label="Indicaciones adicionales"
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
            ) : (
              <div id={`${prefix}-${n}-body`} hidden />
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
            setActive(rows.length);
            setFocusRequest({ id: `${prefix}-${rows.length}-locomotiveNumber` });
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
                onClick={() => {
                  setReview(false);
                  setActive(Math.max(0, active));
                  setError("");
                  setFocusRequest({ id: `${prefix}-${Math.max(0, active)}-locomotiveNumber` });
                }}
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
                if (validate()) {
                  setReview(true);
                  setFocusRequest({ id: `${prefix}-review` });
                }
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
