"use client";

import React, { useEffect } from "react";
import { Movimiento } from "@/features/movimientos/Movimiento";
import ConfirmChoiceAlert from "@/components/ui/ConfirmChoiceAlert";
import { GuidedTarget } from "@/features/capacitacion";
import { Direccion, Posicion, Servicio, Via, Seccion, MovementFormData } from "@/features/movimientos/movimientos.shared";
import { useTrackSelectionConfirmation } from "@/features/movimientos/lifeLineConfirmation.shared";

export const inputBase =
  "w-full rounded-xl border px-3 py-3 min-h-[48px] text-base sm:text-sm outline-none transition-all duration-200 " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-200 " +
  "focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 " +
  "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:border-zinc-700 " +
  "dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20";

export const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, className, id, ...rest } = props;
  const eid = id || `f_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label htmlFor={eid} className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <input
        id={eid}
        {...rest}
        aria-invalid={!!error}
        aria-describedby={error ? `${eid}_err` : undefined}
        className={Movimiento.clsx(inputBase, error && "border-rose-500 focus:border-rose-500", className)}
      />
      {error ? <span id={`${eid}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

export function Step1Edit({
  readOnly,
  form,
  vias,
  sectionsByVia,
  secLoading,
  selectionMode,
  serviceVia,
  setServiceVia,
  setSelectionMode,
  tapToggle,
  setForm,
  ensureSections,
  viaOrigenId,
  setViaOrigenId,
  viaDestinoId,
  setViaDestinoId,
  fromSection,
  setFromSection,
  toSection,
  setToSection,
  locomotiveNumber,
  setLocomotiveNumber,
  viaName,
  empresaLabel,
  localidadLabel,
  visualSection,
}: {
  readOnly: boolean;
  form: MovementFormData;
  vias: Via[];
  sectionsByVia: Record<number, Seccion[]>;
  secLoading: Record<number, boolean>;
  selectionMode: "de_via" | "para_via";
  serviceVia: Servicio | undefined;
  setServiceVia: (v?: Servicio) => void;
  setSelectionMode: (mode: "de_via" | "para_via") => void;
  tapToggle: (key: string, onSingle: () => void, onDouble: () => void) => void;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  ensureSections: (viaId: number) => void;
  viaOrigenId: number | null;
  setViaOrigenId: (v: number | null) => void;
  viaDestinoId: number | null;
  setViaDestinoId: (v: number | null) => void;
  fromSection?: number;
  setFromSection: (v?: number) => void;
  toSection?: number;
  setToSection: (v?: number) => void;
  locomotiveNumber: string;
  setLocomotiveNumber: (v: string) => void;
  viaName: (id?: number | null) => string;
  errors: Record<string, string>;
  empresaLabel: string;
  localidadLabel: string;
  visualSection?: "context" | "service" | "locomotive" | "route";
}) {
  const {
    lifeLineModal,
    requestTrackConfirmation,
    closeTrackConfirmation,
    confirmTrackSelection,
    question: lifeLineQuestion,
    contextLabel: lifeLineContextLabel,
  } = useTrackSelectionConfirmation();

  const optionFrom = (v: Via) => (
    <button
      key={v.id}
      disabled={readOnly}
      onClick={() => {
        if (readOnly) return;
        if (viaOrigenId === v.id) {
          setViaOrigenId(null);
          return;
        }
        requestTrackConfirmation(
          "from",
          String(v.nombre),
          () => setViaOrigenId(v.id),
          v.lineaDeVida
        );
      }}
      className={Movimiento.clsx(
        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:bg-slate-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/60",
        viaOrigenId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20"
      )}
    >
      <span className="truncate">Vía {v.nombre}</span>
    </button>
  );
  const optionTo = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const allOcc: boolean | null = Array.isArray(secs) ? secs.length > 0 && secs.every((x) => x.ocupada) : null;
    const label = allOcc === null ? "—" : allOcc ? "SIN SECC. LIBRES" : "HAY LIBRES";
    const tone = allOcc === null ? "text-slate-500" : allOcc ? "text-rose-600" : "text-emerald-600";
    return (
      <button
        key={v.id}
        disabled={readOnly}
        onClick={() => {
          if (readOnly) return;
          if (viaDestinoId === v.id) {
            setViaDestinoId(null);
            return;
          }
          requestTrackConfirmation(
            "to",
            String(v.nombre),
            () => setViaDestinoId(v.id),
            v.lineaDeVida
          );
        }}
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:bg-slate-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/60",
          viaDestinoId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20"
        )}
      >
        <span className="truncate">Vía {v.nombre}</span>
        <span className={Movimiento.clsx("ml-3 text-xs font-semibold", tone)}>{label}</span>
      </button>
    );
  };

  const SectionsPills = ({ kind, viaId }: { kind: "from" | "to"; viaId?: number | null }) => {
    useEffect(() => {
      if (!viaId) return;
      if (!Array.isArray(sectionsByVia[viaId]) && !secLoading[viaId]) ensureSections(viaId);
    }, [viaId]);

    if (!viaId) return null;
    const loading = !!secLoading[viaId];
    const listRaw = sectionsByVia[viaId];
    const hasData = Array.isArray(listRaw);
    const list = (hasData ? listRaw : [])!.filter((s) => (kind === "from" ? true : !s.ocupada));
    const selected = kind === "from" ? fromSection : toSection;

    return (
      <div className="mt-2 text-sm">
        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
          Secciones de {viaName(viaId)} {loading || !hasData ? "" : `(${list.length})`}
        </div>

        {loading || !hasData ? (
          <div className="py-2 text-slate-500 dark:text-slate-400 italic">Cargando secciones…</div>
        ) : list.length === 0 ? (
          <div className="py-2 text-slate-500 dark:text-slate-400 italic">
            {kind === "to" ? "No hay secciones libres." : "Esta vía no tiene secciones."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((s) => {
              const active = selected === s.numero;
              const color = s.ocupada ? "border-rose-500/50 text-rose-700 dark:text-rose-300 bg-rose-50/50" : "border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50";
              const activeColor = s.ocupada ? "bg-rose-600 text-white border-rose-600" : "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20";

              return (
                <button
                  key={s.id}
                  disabled={readOnly}
                  onClick={() => (kind === "from" ? setFromSection(active ? undefined : s.numero) : setToSection(active ? undefined : s.numero))}
                  className={Movimiento.clsx(
                    "rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95",
                    active ? activeColor : color
                  )}
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

  const handlePriorityToggle = (checked: boolean) => {
    // Priority logic can be simplified for edit if user cannot change it extensively without password
    // For now, keep it simple toggle if editable
    if (readOnly) return;
    setForm(p => ({ ...p, priority: checked }));
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Empresa y Localidad (Disabled) */}
      {(!visualSection || visualSection === "context") && (
        <>
          <Field label="Empresa" value={empresaLabel} disabled />
          <Field label="Localidad" value={localidadLabel} disabled />
        </>
      )}

      {(!visualSection || visualSection === "service") && (
      <div className="sm:col-span-2">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Servicio (Opcional)</span>
        <div className="flex flex-wrap gap-2">
          {(["Lavado", "Torno"] as const).map((svc) => {
            const active = serviceVia === svc;
            return (
              <button
                key={svc}
                onClick={() =>
                  tapToggle(
                    `svc:${svc}`,
                    () => { setForm((p) => ({ ...p, service: svc, toTrack: null })); setServiceVia(svc) },
                    () => { setForm((p) => ({ ...p, service: "", toTrack: p.toTrack })); setServiceVia("") }
                  )
                }
                className={Movimiento.clsx(
                  "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 ring-1 ring-emerald-500/20 shadow-sm"
                    : "border-slate-200 dark:border-zinc-700/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60 bg-white dark:bg-zinc-900"
                )}
              >
                {svc}
              </button>
            );
          })}
          {serviceVia ? <span className="self-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Doble clic para desmarcar</span> : null}
        </div>
      </div>
      )}
      {(!visualSection || visualSection === "service") && (serviceVia || selectionMode) && (
        <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Modo de selección</span>
          <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50">
            <button
              onClick={() => setSelectionMode("de_via")}
              className={Movimiento.clsx(
                "rounded-lg px-4 py-2 text-sm font-medium flex-1 transition-all",
                selectionMode === "de_via"
                  ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-400 ring-1 ring-slate-200 dark:ring-zinc-700"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              De vía
            </button>
            <button
              onClick={() => setSelectionMode("para_via")}
              className={Movimiento.clsx(
                "rounded-lg px-4 py-2 text-sm font-medium flex-1 transition-all",
                selectionMode === "para_via"
                  ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-400 ring-1 ring-slate-200 dark:ring-zinc-700"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              Para vía
            </button>
          </div>
        </div>
      )}

      {/* Prioridad + Loco */}
      {(!visualSection || visualSection === "locomotive") && (
      <div className="sm:col-span-2 grid sm:grid-cols-2 gap-5 items-end">
        <div>
          <label className="mb-3 mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700"
              checked={form.priority}
              onChange={(e) => handlePriorityToggle(e.target.checked)}
              disabled={readOnly}
            />
            <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Prioridad alta</span>
          </label>
        </div>
        <Field
          label="Número de locomotora"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={locomotiveNumber}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^\d+$/.test(value)) {
              setLocomotiveNumber(value);
            }
          }}
          disabled={readOnly}
          placeholder="Ej. 4501"
        />
      </div>
      )}

      {/* Origen */}
      {(!visualSection || visualSection === "route") && (selectionMode === "de_via" || !serviceVia) &&
        (<div className="sm:col-span-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">De vía (origen)</span>
          <div className="flex gap-2">
            <button
              onClick={() => { /* toggled by list */ }}
              className="min-w-[220px] rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-slate-50 dark:bg-zinc-800/60 px-3 py-2.5 text-left text-slate-700 dark:text-zinc-300 font-medium"
              disabled
              title="Selecciona abajo"
            >
              {viaOrigenId ? `Vía ${viaName(viaOrigenId)}` : "Selecciona una vía..."}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
            {Movimiento.TrackFilter(vias, selectionMode, "de_via", serviceVia).map((v) => (<div key={v.id}>{optionFrom(v)}</div>))}
          </div>
          <SectionsPills kind="from" viaId={viaOrigenId} />
        </div>)}
      {(!visualSection || visualSection === "route") && (selectionMode === "para_via" || !serviceVia) && (<div className="sm:col-span-2 animate-in fade-in slide-in-from-right-2 duration-300">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Para vía (destino)</span>
        <div className="flex gap-2">
          <button
            onClick={() => { /* toggled by list */ }}
            className="min-w-[220px] rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-left text-slate-700 dark:text-slate-300 font-medium"
            disabled
            title="Selecciona abajo"
          >
            {viaDestinoId ? `Vía ${viaName(viaDestinoId)}` : "Selecciona una vía..."}
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
          {Movimiento.TrackFilter(vias, selectionMode, "para_via", serviceVia).map((v) => (<div key={v.id}>{optionTo(v)}</div>))}
        </div>
        <SectionsPills kind="to" viaId={viaDestinoId} />
      </div>)}

      <ConfirmChoiceAlert
        open={Boolean(lifeLineModal)}
        question={lifeLineQuestion}
        contextLabel={lifeLineContextLabel}
        onCancel={closeTrackConfirmation}
        onConfirm={confirmTrackSelection}
      />
    </div>
  );
}

export function Step2Edit({
  readOnly,
  tipoMovimiento,
  setTipoMovimiento,
  posicionCabina,
  setPosicionCabina,
  posicionChimenea,
  setPosicionChimenea,
  direccionEmpuje,
  setDireccionEmpuje,
  polo,
  setPolo,
  errors,
}: {
  readOnly: boolean;
  tipoMovimiento: "" | "MD_TRABAJANDO" | "REMOLCADA";
  setTipoMovimiento: (v: "MD_TRABAJANDO" | "REMOLCADA" | "") => void;
  posicionCabina: Posicion;
  setPosicionCabina: (v: Posicion) => void;
  posicionChimenea: Posicion;
  setPosicionChimenea: (v: Posicion) => void;
  direccionEmpuje: Direccion;
  setDireccionEmpuje: (v: Direccion) => void;
  polo: "NORTE" | "SUR" | "Sin_Solicitar";
  setPolo: (v: "NORTE" | "SUR" | "Sin_Solicitar") => void;
  errors: Record<string, string>;
}) {
  const Card = ({
    active,
    label,
    onClick,
    disabled,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={Movimiento.clsx(
        "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
        "border-slate-200 dark:border-zinc-700/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="font-medium text-slate-800 dark:text-zinc-200">{label}</span>
      <span className={Movimiento.clsx("ml-3 rounded-full px-2.5 py-0.5 text-xs font-semibold", active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400")}>
        {active ? "✓ Seleccionado" : "Elegir"}
      </span>
    </button>
  );

  return (
    <div className="grid gap-6">
      {/* Tipo */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Tipo de movimiento</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card label="MD Trabajando" active={tipoMovimiento === "MD_TRABAJANDO"} onClick={() => setTipoMovimiento("MD_TRABAJANDO")} disabled={readOnly} />
          <Card label="Remolcada" active={tipoMovimiento === "REMOLCADA"} onClick={() => setTipoMovimiento("REMOLCADA")} disabled={readOnly} />
        </div>
        {errors.tipoMovimiento && <div className="mt-1 text-xs text-rose-600 font-medium">{errors.tipoMovimiento}</div>}
      </div>

      {tipoMovimiento === "REMOLCADA" && (
        <div className="animate-in fade-in slide-in-from-top-2">
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Dirección de empuje</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card label="Empujar" active={direccionEmpuje === "EMPUJAR"} onClick={() => setDireccionEmpuje("EMPUJAR")} disabled={readOnly} />
            <Card label="Jalar" active={direccionEmpuje === "JALAR"} onClick={() => setDireccionEmpuje("JALAR")} disabled={readOnly} />
          </div>
          {errors.direccionEmpuje && <div className="mt-1 text-xs text-rose-600 font-medium">{errors.direccionEmpuje}</div>}
        </div>
      )}

      {/* Cabina/Chimenea */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Posición Cabina</div>
          <div className="flex flex-col gap-2">
            <Card label="Dentro" active={posicionCabina === "DENTRO"} onClick={() => setPosicionCabina("DENTRO")} disabled={readOnly} />
            <Card label="Afuera" active={posicionCabina === "AFUERA"} onClick={() => setPosicionCabina("AFUERA")} disabled={readOnly} />
            <Card label="Sin solicitar" active={posicionCabina === "Sin_Solicitar"} onClick={() => setPosicionCabina("Sin_Solicitar")} disabled={readOnly} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Posición Chimenea</div>
          <div className="flex flex-col gap-2">
            <Card label="Dentro" active={posicionChimenea === "DENTRO"} onClick={() => setPosicionChimenea("DENTRO")} disabled={readOnly} />
            <Card label="Afuera" active={posicionChimenea === "AFUERA"} onClick={() => setPosicionChimenea("AFUERA")} disabled={readOnly} />
            <Card label="Sin solicitar" active={posicionChimenea === "Sin_Solicitar"} onClick={() => setPosicionChimenea("Sin_Solicitar")} disabled={readOnly} />
          </div>
        </div>
      </div>

      {/* Polo */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Polo (Opcional)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="Norte" active={polo === "NORTE"} onClick={() => setPolo("NORTE")} disabled={readOnly} />
          <Card label="Sur" active={polo === "SUR"} onClick={() => setPolo("SUR")} disabled={readOnly} />
          <Card label="Sin solicitar" active={polo === "Sin_Solicitar"} onClick={() => setPolo("Sin_Solicitar")} disabled={readOnly} />
        </div>
      </div>
    </div>
  );
}

export function Step3Edit({
  readOnly,
  instrucciones,
  setInstrucciones,
  resumen,
  metaHint,
  saving,
  onSubmit,
}: {
  readOnly: boolean;
  instrucciones: string;
  setInstrucciones: (v: string) => void;
  resumen: { localidad?: string; origen: string; destino: string; loco: string; tipo: string; dir: string };
  metaHint: string;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border p-3 text-sm dark:border-zinc-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-zinc-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-zinc-300">
          <li>Localidad: {resumen.localidad ?? "—"}</li>
          <li>Origen: {resumen.origen ?? "—"}</li>
          <li>Destino: {resumen.destino ?? "—"}</li>
          <li>Locomotora: {resumen.loco || "—"}</li>
          <li>Tipo: {resumen.tipo || "—"}</li>
          <li>Dirección: {resumen.dir || "—"}</li>
        </ul>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
          Comentarios / instrucciones
        </label>
        <textarea
          rows={6}
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          disabled={readOnly}
          className={Movimiento.clsx(inputBase, "min-h-[120px] resize-none")}
          placeholder="Escriba instrucciones específicas..."
        />
        {metaHint && <div className="mt-2 text-xs text-slate-400 font-mono bg-slate-50 dark:bg-zinc-900/50 p-2 rounded border border-slate-100 dark:border-zinc-800 break-all">{metaHint}</div>}
      </div>

      <GuidedTarget id="edit-movement-save" className="inline-flex">
        <button
          onClick={onSubmit}
          disabled={readOnly || saving}
          className={Movimiento.clsx(
            "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98]",
            readOnly
              ? "bg-slate-400 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25",
            saving && "opacity-70 cursor-wait"
          )}
          title={readOnly ? "No editable" : "Guardar cambios"}
        >
          {saving ? (
            <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Guardando cambios…</>
          ) : "✓ Guardar Cambios"}
        </button>
      </GuidedTarget>
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "error" | "muted"; children: React.ReactNode }) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
    muted: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  } as const;
  return <span className={Movimiento.clsx(chipBase, map[tone])}>{children}</span>;
}

export function RoleBadge({ rol, canManageAll }: { rol: string; canManageAll: boolean }) {
  const R = String(rol || "").toUpperCase();
  const tone = canManageAll ? "ok" : (R === "SUPERVISOR" ? "warn" : "muted");
  const text =
    canManageAll
      ? `${R} · puede elegir empresa y localidad`
      : `${R} · solo su empresa${R === "CLIENTE" || R === "SUPERVISOR" ? " y localidad asignada" : ""}`;
  return <Badge tone={tone}>{text}</Badge>;
}
