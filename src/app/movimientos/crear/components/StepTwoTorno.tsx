import React, { useEffect, useMemo, useState } from "react";
import { Movimiento } from "../../Movimiento";
import type { MovementFormData } from "../../movimientos.shared";
import {
  EMPTY_TORNO_ROW,
  EMPTY_TORNO_VALUE,
  formatTornoMeasure,
  getTornoPositions,
  TORNO_DEN_OPTIONS,
  TORNO_WHEEL_COUNT_OPTIONS,
  type TornoMeasurementField,
  type TornoMeasurementPart,
  type TornoMedicionState,
  type TornoMeasurementValue,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "../tornoMedicion.types";
import {
  resolveTornoProfile,
  TORNO_PROFILE_FIELDS,
  TORNO_PROFILE_META,
  type TornoFieldDef,
} from "../tornoProfiles";

/**
 * Props del Step 2 especializado para servicio Torno.
 */
type StepTwoTornoProps = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  tornoMedicion: TornoMedicionState;
  setTornoWheelCount: (count: TornoWheelCount) => void;
  updateTornoMedicion: (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    part: TornoMeasurementPart,
    value: string
  ) => void;
  companyName?: string;
};

function CompactChoice(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { active, label, onClick } = props;
  return (
    <button
      onClick={onClick}
      className={Movimiento.clsx(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 sm:text-sm",
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      )}
    >
      {label}
    </button>
  );
}

function MeasurePartsInput(props: {
  value: TornoMeasurementValue;
  onChange: (part: TornoMeasurementPart, value: string) => void;
  compact?: boolean;
}) {
  const { value, onChange, compact } = props;

  return (
    <div
      className={Movimiento.clsx(
        "flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1",
        compact ? "min-w-[156px]" : "w-full"
      )}
    >
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="in"
        value={value.whole}
        onChange={(e) => onChange("whole", e.target.value)}
        className="h-7 w-10 rounded-md border border-slate-700 bg-slate-900 px-1.5 text-center text-xs text-slate-100 outline-none focus:border-emerald-500"
        aria-label="Pulgadas enteras (opcional)"
      />
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="num"
        value={value.num}
        onChange={(e) => onChange("num", e.target.value)}
        className="h-7 w-10 rounded-md border border-slate-700 bg-slate-900 px-1.5 text-center text-xs text-slate-100 outline-none focus:border-emerald-500"
        aria-label="Numerador"
      />
      <span className="text-xs font-semibold text-slate-400">/</span>
      <select
        value={value.den}
        onChange={(e) => onChange("den", e.target.value)}
        className="h-7 w-12 rounded-md border border-slate-700 bg-slate-900 px-1 text-center text-xs text-slate-100 outline-none focus:border-emerald-500"
        aria-label="Denominador"
      >
        {TORNO_DEN_OPTIONS.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || "--"}
          </option>
        ))}
      </select>
      <span className="text-xs font-semibold text-slate-400">&quot;</span>
    </div>
  );
}

function PositionRow(props: {
  position: TornoWheelPosition;
  fieldDefs: TornoFieldDef[];
  row: TornoMedicionState["rows"][TornoWheelPosition] | undefined;
  updateTornoMedicion: StepTwoTornoProps["updateTornoMedicion"];
}) {
  const { position, fieldDefs, row, updateTornoMedicion } = props;

  return (
    <tr className="border-t border-slate-800">
      <td className="sticky left-0 z-[1] border-r border-slate-800 bg-slate-950 px-3 py-2 font-semibold text-slate-100">
        {position}
      </td>
      {fieldDefs.map((field) => {
        const measure = row?.[field.key] ?? EMPTY_TORNO_VALUE;
        return (
          <td key={`${position}_${field.key}`} className="px-3 py-2">
            <MeasurePartsInput
              compact
              value={measure}
              onChange={(part, value) => updateTornoMedicion(position, field.key, part, value)}
            />
          </td>
        );
      })}
    </tr>
  );
}

function SideTable(props: {
  title: string;
  positions: TornoWheelPosition[];
  fieldDefs: TornoFieldDef[];
  rows: TornoMedicionState["rows"];
  updateTornoMedicion: StepTwoTornoProps["updateTornoMedicion"];
}) {
  const { title, positions, fieldDefs, rows, updateTornoMedicion } = props;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200">
        {title}
      </div>
      <div className="overflow-auto">
        <table className="min-w-[620px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
            <tr>
              <th className="sticky left-0 z-20 border-r border-slate-800 bg-slate-900/95 px-3 py-2 text-left font-semibold text-slate-300">Pos.</th>
              {fieldDefs.map((field) => (
                <th key={field.key} className="px-3 py-2 text-left font-semibold text-slate-300">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <PositionRow
                key={`${title}_${position}`}
                position={position}
                fieldDefs={fieldDefs}
                row={rows[position] ?? EMPTY_TORNO_ROW}
                updateTornoMedicion={updateTornoMedicion}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Step 2 (Torno):
 * - Plantillas por empresa (Wabtec / Altom / Progress / Default).
 * - Captura fraccional guiada y responsiva.
 */
export default function StepTwoTorno(props: StepTwoTornoProps) {
  const {
    form,
    setForm,
    errors,
    tornoMedicion,
    setTornoWheelCount,
    updateTornoMedicion,
    companyName,
  } = props;

  const profile = useMemo(() => resolveTornoProfile(companyName), [companyName]);
  const profileMeta = TORNO_PROFILE_META[profile];
  const fieldDefs = TORNO_PROFILE_FIELDS[profile];

  const positions = useMemo(
    () => getTornoPositions(tornoMedicion.wheelCount),
    [tornoMedicion.wheelCount]
  );

  const leftPositions = useMemo(
    () => positions.filter((position) => position.startsWith("L")),
    [positions]
  );

  const rightPositions = useMemo(
    () => positions.filter((position) => position.startsWith("R")),
    [positions]
  );

  const [mobilePosition, setMobilePosition] = useState<TornoWheelPosition>("L1");

  useEffect(() => {
    if (!positions.includes(mobilePosition)) {
      setMobilePosition(positions[0] ?? "L1");
    }
  }, [positions, mobilePosition]);

  const selectedMobileRow = tornoMedicion.rows[mobilePosition] ?? EMPTY_TORNO_ROW;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-800 bg-[#0d1117] p-4 text-slate-100 shadow-xl sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Registro de Medidas</h3>
            <p className="text-sm text-slate-300">{profileMeta.description}</p>
            <span className="mt-1 inline-flex rounded-full border border-slate-600 px-2.5 py-0.5 text-xs font-semibold text-slate-200">
              {profileMeta.title}
            </span>
          </div>
          <div className="rounded-full border border-emerald-600/60 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
            Locomotora: {form.locomotiveNumber || "-"}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ruedas</div>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-700">
              {TORNO_WHEEL_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  onClick={() => setTornoWheelCount(count)}
                  className={Movimiento.clsx(
                    "px-3 py-1.5 text-xs font-semibold transition-colors duration-200 sm:px-4 sm:text-sm",
                    tornoMedicion.wheelCount === count
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-900 text-slate-200 hover:bg-slate-800"
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tipo</div>
            <div className="flex flex-wrap gap-2">
              <CompactChoice
                label="MD Trabajando"
                active={form.movementType === "MD_TRABAJANDO"}
                onClick={() => setForm((p) => ({ ...p, movementType: "MD_TRABAJANDO", direccionEmpuje: "Sin_Solicitar", pushPull: "" }))}
              />
              <CompactChoice
                label="Remolcada"
                active={form.movementType === "REMOLCADA"}
                onClick={() => setForm((p) => ({ ...p, movementType: "REMOLCADA" }))}
              />
            </div>
            {errors.movementType ? <div className="mt-1 text-xs text-rose-400">{errors.movementType}</div> : null}
          </div>

          {form.movementType === "REMOLCADA" ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Direccion</div>
              <div className="flex flex-wrap gap-2">
                <CompactChoice
                  label="Empujar"
                  active={form.direccionEmpuje === "EMPUJAR"}
                  onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "EMPUJAR", pushPull: "EMPUJAR" }))}
                />
                <CompactChoice
                  label="Jalar"
                  active={form.direccionEmpuje === "JALAR"}
                  onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "JALAR", pushPull: "JALAR" }))}
                />
              </div>
              {errors.direccionEmpuje ? <div className="mt-1 text-xs text-rose-400">{errors.direccionEmpuje}</div> : null}
            </div>
          ) : null}
        </div>

        <div className="lg:hidden">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {positions.map((position) => (
              <button
                key={`mobile_${position}`}
                onClick={() => setMobilePosition(position)}
                className={Movimiento.clsx(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                  mobilePosition === position
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-200"
                )}
              >
                {position}
              </button>
            ))}
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            {fieldDefs.map((field) => {
              const measure = selectedMobileRow[field.key] ?? EMPTY_TORNO_VALUE;
              return (
                <div key={`mobile_field_${field.key}`} className="rounded-lg border border-slate-800 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">{field.label}</span>
                    <span className="text-[11px] text-slate-400">{formatTornoMeasure(measure) || "-"}</span>
                  </div>
                  <MeasurePartsInput
                    value={measure}
                    onChange={(part, value) => updateTornoMedicion(mobilePosition, field.key, part, value)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {profile === "wabtec" ? (
          <div className="hidden lg:grid grid-cols-2 gap-4">
            <SideTable
              title="Izquierdo"
              positions={leftPositions}
              fieldDefs={fieldDefs}
              rows={tornoMedicion.rows}
              updateTornoMedicion={updateTornoMedicion}
            />
            <SideTable
              title="Derecho"
              positions={rightPositions}
              fieldDefs={fieldDefs}
              rows={tornoMedicion.rows}
              updateTornoMedicion={updateTornoMedicion}
            />
          </div>
        ) : (
          <div className="hidden overflow-hidden rounded-xl border border-slate-800 lg:block">
            <div className="max-h-[54vh] overflow-auto">
              <table className="min-w-[1080px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
                  <tr>
                    <th className="sticky left-0 z-20 border-r border-slate-800 bg-slate-900/95 px-3 py-3 text-left font-semibold text-slate-300">Posicion</th>
                    {fieldDefs.map((field) => (
                      <th key={field.key} className="px-3 py-3 text-left font-semibold text-slate-300">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <PositionRow
                      key={`desktop_${position}`}
                      position={position}
                      fieldDefs={fieldDefs}
                      row={tornoMedicion.rows[position] ?? EMPTY_TORNO_ROW}
                      updateTornoMedicion={updateTornoMedicion}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Las medidas son opcionales por campo y se guardan en draft local durante esta solicitud.
        </p>
      </section>
    </div>
  );
}
