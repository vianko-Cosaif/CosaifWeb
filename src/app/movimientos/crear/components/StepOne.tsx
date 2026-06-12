import React, { useState } from "react";
import { Movimiento } from "../../Movimiento";
import {
  ALTA_PASSWORDS,
  Empresa,
  Localidad,
  MovementFormData,
  Seccion,
  Via,
} from "../../movimientos.shared";
import { Field, Select, inputBase } from "./ui";
import ScheduledTornoActivationModal, { type ScheduledTornoMovement } from "./ScheduledTornoActivationModal";

type SelectionMode = "de_via" | "para_via";

/**
 * Props del Step 1 (Datos operativos).
 * Este step solo renderiza y notifica cambios;
 * las reglas de negocio viven en el controlador.
 */
type StepOneProps = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  empresas: Empresa[];
  localidades: Localidad[];
  vias: Via[];
  canManageAll: boolean;
  userCompanyName: string;
  showFromOpts: boolean;
  setShowFromOpts: (v: boolean) => void;
  showToOpts: boolean;
  setShowToOpts: (v: boolean) => void;
  selectionMode: SelectionMode;
  setSelectionMode: (mode: SelectionMode) => void;
  tapToggle: (key: string, onSingle: () => void, onDouble: () => void) => void;
  sectionsByVia: Record<number, Seccion[]>;
  secLoading: Record<number, boolean>;
  ensureSections: (viaId: number) => void;
  fromSection?: number;
  toSection?: number;
  setFromSection: (s: Seccion) => void | Promise<void>;
  setToSection: (n?: number) => void;
  viaName: (id?: number | null) => string;
  companyName?: string;
  scheduledTornoMovements?: ScheduledTornoMovement[];
  scheduledTornoLoading?: boolean;
  onRefreshScheduledTorno?: () => Promise<void> | void;
  onActivateScheduledTorno: (movement: ScheduledTornoMovement) => Promise<void> | void;
};

const toDatetimeLocalValue = (value?: string) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDatetimeLocalValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

/**
 * Step 1:
 * - Empresa/localidad.
 * - Servicio y modo de seleccion.
 * - Vias de origen/destino.
 * - Seleccion de secciones.
 * - Prioridad y locomotora.
 */
export default function StepOne(props: StepOneProps) {
  const {
    form, setForm, errors, empresas, localidades, vias, canManageAll, userCompanyName,
    showFromOpts, setShowFromOpts, showToOpts, setShowToOpts, selectionMode, setSelectionMode,
    tapToggle, sectionsByVia, secLoading, ensureSections, fromSection, toSection,
    setFromSection, setToSection, viaName, companyName, scheduledTornoMovements = [],
    scheduledTornoLoading = false, onRefreshScheduledTorno, onActivateScheduledTorno,
  } = props;

  const [altaOpen, setAltaOpen] = useState(false);
  const [altaPwd, setAltaPwd] = useState("");
  const [altaErr, setAltaErr] = useState<string | null>(null);

  /** Resuelve empresa efectiva para validar prioridad ALTA. */
  const getEmpId = () => {
    const fromForm = Number(form.empresaId ?? NaN);
    if (Number.isFinite(fromForm) && fromForm > 0) return fromForm;

    const fromCookie = Number(Movimiento.getCookie("empresaId") || NaN);
    if (Number.isFinite(fromCookie) && fromCookie > 0) return fromCookie;

    try {
      const rawUser = sessionStorage.getItem("user") || localStorage.getItem("user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const uid = Number(u?.empresaId ?? u?.empresa?.id ?? NaN);
        if (Number.isFinite(uid) && uid > 0) return uid;

        const uname = String(u?.empresa?.nombre || "").trim().toLowerCase();
        if (uname) {
          const match = empresas.find((e) => String(e?.nombre || "").trim().toLowerCase() === uname);
          if (match && Number.isFinite(Number(match.id)) && Number(match.id) > 0) return Number(match.id);
        }
      }

      const rawEmpId = Number(sessionStorage.getItem("empresaId") ?? localStorage.getItem("empresaId") ?? NaN);
      if (Number.isFinite(rawEmpId) && rawEmpId > 0) return rawEmpId;
    } catch { }

    const byName = String(userCompanyName || "").trim().toLowerCase();
    if (byName) {
      const match = empresas.find((e) => String(e?.nombre || "").trim().toLowerCase() === byName);
      if (match && Number.isFinite(Number(match.id)) && Number(match.id) > 0) return Number(match.id);
    }

    return NaN;
  };

  /** Abre modal de confirmacion de prioridad ALTA con guardas minimas. */
  const handlePriorityToggle = (checked: boolean) => {
    if (!checked) {
      setForm((p) => ({ ...p, priority: false }));
      return;
    }

    const empId = getEmpId();
    if (!Number.isFinite(empId)) {
      alert("Selecciona una empresa antes de marcar prioridad alta.");
      return;
    }

    if (!canManageAll && !Number.isFinite(Number(form.empresaId))) {
      setForm((p) => ({ ...p, empresaId: empId }));
    }

    setAltaPwd("");
    setAltaErr(null);
    setAltaOpen(true);
  };

  /** Valida la contraseña de ALTA y confirma prioridad. */
  const confirmAltaPwd = () => {
    const empId = getEmpId();
    const expected = ALTA_PASSWORDS[empId];

    if (!expected) {
      setAltaErr("No hay contraseña configurada para esta empresa.");
      return;
    }

    if (altaPwd.trim() !== expected) {
      setAltaErr("Contraseña inválida.");
      return;
    }

    setForm((p) => ({ ...p, priority: true }));
    setAltaOpen(false);
    setAltaPwd("");
    setAltaErr(null);
  };

  /** Cancela flujo de prioridad ALTA. */
  const cancelAltaPwd = () => {
    setAltaOpen(false);
    setAltaPwd("");
    setAltaErr(null);
    setForm((p) => ({ ...p, priority: false }));
  };

  /** Render de opcion de via origen. */
  const viaOption = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const anyOcc: boolean | null = Array.isArray(secs) ? secs.some((x) => x.ocupada) : null;
    const label = anyOcc === null ? "-" : anyOcc ? "OCUPADA" : "LIBRE";
    const tone = anyOcc === null ? "text-slate-500" : anyOcc ? "text-rose-600" : "text-emerald-600";

    const isServiceVia = ["torno", "lavado"].includes(v.nombre.toLowerCase());
    const isDisabled = !form.service && isServiceVia;

    return (
      <button
        key={v.id}
        onClick={() => !isDisabled && setForm((p) => ({ ...p, fromTrack: p.fromTrack === v.id ? null : v.id }))}
        disabled={isDisabled}
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors duration-200",
          isDisabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500"
            : form.fromTrack === v.id
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
              : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        )}
      >
        <span className="truncate">Via {isDisabled ? `${v.nombre} (solo servicio)` : v.nombre}</span>
        <span className={Movimiento.clsx("ml-3 text-xs font-semibold", isDisabled ? "text-slate-400 dark:text-slate-500" : tone)}>
          {isDisabled ? "NO DISPONIBLE" : label}
        </span>
      </button>
    );
  };

  /** Render de opcion de via destino. */
  const viaOptionTo = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const allOcc: boolean | null = Array.isArray(secs) ? secs.length > 0 && secs.every((x) => x.ocupada) : null;
    const label = allOcc === null ? "-" : allOcc ? "SIN SECC. LIBRES" : "HAY LIBRES";
    const tone = allOcc === null ? "text-slate-500" : allOcc ? "text-rose-600" : "text-emerald-600";

    return (
      <button
        key={v.id}
        onClick={() => setForm((p) => ({ ...p, toTrack: p.toTrack === v.id ? null : v.id }))}
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors duration-200",
          allOcc === true ? "opacity-60" : "",
          form.toTrack === v.id
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
            : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        )}
      >
        <span className="truncate">Via {v.nombre}</span>
        <span className={Movimiento.clsx("ml-3 text-xs font-semibold", tone)}>{label}</span>
      </button>
    );
  };

  /**
   * Subcomponente local para pintar secciones por via.
   * En destino filtra secciones ocupadas.
   */
  const SectionsPills = ({ kind, viaId }: { kind: "from" | "to"; viaId?: number | null }) => {
    if (!viaId) return null;

    const loading = !!secLoading[viaId];
    const listRaw = sectionsByVia[viaId];
    const hasData = Array.isArray(listRaw);
    const list = (hasData ? listRaw : [])!.filter((s) => (kind === "from" ? true : !s.ocupada));
    const selected = kind === "from" ? fromSection : toSection;

    return (
      <div className="mt-2">
        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          Secciones de {viaName(viaId)} {loading || !hasData ? "" : `(${list.length})`}
        </div>

        {loading || !hasData ? (
          <div className="py-2 text-sm text-slate-500 dark:text-slate-400">Cargando secciones...</div>
        ) : list.length === 0 ? (
          <div className="py-2 text-sm text-slate-500 dark:text-slate-400">
            {kind === "to" ? "No hay secciones libres." : "Esta via no tiene secciones."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((s) => {
              const active = selected === s.numero;
              const color = s.ocupada ? "border-rose-500 text-rose-700 dark:text-rose-300" : "border-emerald-500 text-emerald-700 dark:text-emerald-300";
              return (
                <button
                  key={s.id}
                  onClick={() => (kind === "from" ? setFromSection(s) : setToSection(active ? undefined : s.numero))}
                  className={Movimiento.clsx("rounded-full border px-3 py-1 text-xs font-semibold", color, active && (s.ocupada ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"))}
                >
                  #{s.numero}{s.nombre ? ` · ${s.nombre}` : ""}{s.ocupada ? " · OCUP" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const empresaLabel =
    empresas.find((e) => e.id === form.empresaId)?.nombre ||
    userCompanyName || (Number.isFinite(Number(form.empresaId)) ? `ID ${form.empresaId}` : "");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {canManageAll ? (
        <Select
          label="Empresa"
          value={form.empresaId ?? ""}
          onChange={(v) => setForm((p) => ({ ...p, empresaId: v ? Number(v) : null }))}
          options={empresas.map((e) => ({ label: e.nombre, value: String(e.id) }))}
          error={errors.empresaId}
        />
      ) : (
        <Field label="Empresa" value={empresaLabel} disabled />
      )}

      {canManageAll ? (
        <Select
          label="Localidad"
          value={form.selectedLocalityId ?? ""}
          onChange={(v) => setForm((p) => ({ ...p, selectedLocalityId: v ? Number(v) : null, fromTrack: null, toTrack: null }))}
          options={localidades.map((l) => ({ label: l.nombre, value: String(l.id) }))}
          error={errors.selectedLocalityId}
        />
      ) : (
        <Field
          label="Localidad"
          value={localidades.find((l) => l.id === form.selectedLocalityId)?.nombre || (form.selectedLocalityId ? `ID ${form.selectedLocalityId}` : "")}
          disabled
          error={errors.selectedLocalityId}
        />
      )}

      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Servicio</span>
        <div className="flex flex-wrap gap-2">
          {(["Lavado", "Torno"] as const).map((svc) => {
            const active = form.service === svc;
            return (
              <button
                key={svc}
                onClick={() =>
                  tapToggle(
                    `svc:${svc}`,
                    () => setForm((p) => ({
                      ...p,
                      service: svc,
                      toTrack: null,
                      ...(svc === "Torno" ? {} : { agendado: false, fechaProgramada: "" }),
                    })),
                    () => setForm((p) => ({ ...p, service: "", toTrack: p.toTrack, agendado: false, fechaProgramada: "" }))
                  )
                }
                className={Movimiento.clsx(
                  "rounded-md border px-3 py-2 text-sm",
                  active ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                )}
              >
                {svc}
              </button>
            );
          })}
          {form.service ? <span className="self-center text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</span> : null}
        </div>
      </div>

      {form.service === "Torno" ? (
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
              checked={!!form.agendado}
              onChange={(event) => {
                const checked = event.target.checked;
                setForm((p) => ({
                  ...p,
                  agendado: checked,
                  fechaProgramada: checked
                    ? (p.fechaProgramada || new Date(Date.now() + 60 * 60 * 1000).toISOString())
                    : "",
                }));
              }}
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Agendar movimiento</span>
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Programa este torno para otra fecha y hora. Al activarlo se colocara en ronda.
          </p>
          {form.agendado ? (
            <div className="mt-3 max-w-sm">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Fecha y hora programada
              </label>
              <input
                type="datetime-local"
                className={inputBase}
                value={toDatetimeLocalValue(form.fechaProgramada)}
                min={toDatetimeLocalValue(new Date().toISOString())}
                onChange={(event) => {
                  const nextValue = fromDatetimeLocalValue(event.target.value);
                  setForm((p) => ({ ...p, agendado: true, fechaProgramada: nextValue }));
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {form.service && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Modo de seleccion</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectionMode("de_via")}
              className={Movimiento.clsx(
                "rounded-md border px-3 py-2 text-sm",
                selectionMode === "de_via"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              De via
            </button>
            <button
              onClick={() => setSelectionMode("para_via")}
              className={Movimiento.clsx(
                "rounded-md border px-3 py-2 text-sm",
                selectionMode === "para_via"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              Para via
            </button>
        
          </div>
        </div>
      )}

      <label className="mb-3 mt-1 flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
          checked={form.priority}
          onChange={(e) => handlePriorityToggle(e.target.checked)}
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          Prioridad alta
        </span>
      </label>
      {form.priority === false && (
        <div className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-2">
          Para activar ALTA se requiere contrasena segun la empresa.
        </div>
      )}

      <Field
        label="Numero de locomotora"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={form.locomotiveNumber ? String(form.locomotiveNumber) : ""}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "" || /^\d+$/.test(value)) {
            setForm((p) => ({ ...p, locomotiveNumber: value }));
          }
        }}
        className=""
        disabled={false}
        error={errors.locomotiveNumber}
      />
      <div className="sm:col-span-2 -mt-2">
        <ScheduledTornoActivationModal
          enabled={form.service === "Torno"}
          locomotiveNumber={form.locomotiveNumber}
          viaOrigenId={form.fromTrack}
          localidadId={form.selectedLocalityId}
          scheduledMovements={scheduledTornoMovements}
          loading={scheduledTornoLoading}
          companyName={companyName}
          onRefresh={onRefreshScheduledTorno}
          onActivate={onActivateScheduledTorno}
        />
      </div>

      {(!form.service || selectionMode === "de_via") && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">De via</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowFromOpts(!showFromOpts); if (form.fromTrack) ensureSections(form.fromTrack); }}
              className={Movimiento.clsx(
                "min-w-[220px] rounded-md border px-3 py-2 text-left transition-colors duration-200",
                form.fromTrack
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              {form.fromTrack ? `Via ${viaName(form.fromTrack)}` : "Selecciona una via"}
            </button>
            {errors.fromTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.fromTrack}</span> : null}
          </div>

          {showFromOpts && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Movimiento.TrackFilter(vias, selectionMode, "de_via", form.service)
                .map((v) => (
                  <div key={v.id}>
                    {viaOption(v)}
                  </div>
                ))}
            </div>
          )}

          <SectionsPills kind="from" viaId={form.fromTrack} />
        </div>
      )}

      {(!form.service || selectionMode === "para_via") && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Para via</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowToOpts(!showToOpts); if (form.toTrack) ensureSections(form.toTrack); }}
              className={Movimiento.clsx(
                "min-w-[220px] rounded-md border px-3 py-2 text-left transition-colors duration-200",
                form.toTrack
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              {form.toTrack ? `Via ${viaName(form.toTrack)}` : "Selecciona una via"}
            </button>
            {errors.toTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.toTrack}</span> : null}
          </div>

          {showToOpts && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Movimiento.TrackFilter(vias, selectionMode, "para_via", form.service)
                .map((v) => (
                  <div key={v.id}>
                    {viaOptionTo(v)}
                  </div>
                ))}
            </div>
          )}
          <SectionsPills kind="to" viaId={form.toTrack} />
        </div>
      )}

      {altaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100">Confirmar prioridad ALTA</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ingresa la contrasena de ALTA para la empresa seleccionada.
            </div>
            <div className="mt-3">
              <input
                type="password"
                className={Movimiento.clsx(inputBase, altaErr && "border-rose-500 focus:border-rose-500")}
                value={altaPwd}
                onChange={(e) => { setAltaPwd(e.target.value); setAltaErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") confirmAltaPwd(); }}
                placeholder="Contrasena de ALTA"
                autoFocus
              />
              {altaErr && <div className="mt-1 text-xs text-rose-600">{altaErr}</div>}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmAltaPwd} className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">Confirmar</button>
              <button onClick={cancelAltaPwd} className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
