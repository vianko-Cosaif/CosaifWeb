import React from "react";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { Movimiento } from "../../Movimiento";
import { MovementFormData } from "../../movimientos.shared";

/**
 * Props del Step 2 (configuracion tecnica del movimiento).
 */
type StepTwoProps = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  isService: boolean;
};

/**
 * Step 2:
 * - Tipo de movimiento.
 * - Posicionamiento (polo/cabina/chimenea) cuando NO es servicio.
 * - Direccion para remolcadas.
 */
export default function StepTwo({ form, setForm, errors, isService }: StepTwoProps) {
  /** Tarjeta reutilizable para opciones binarias y de seleccion unica. */
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
        "flex w-full items-center justify-between rounded-md border px-3 py-3 text-left",
        "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
        disabled && "opacity-50 cursor-not-allowed",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={Movimiento.clsx(
          "ml-3 rounded-full px-2 py-0.5 text-xs",
          active ? "border border-emerald-500 text-emerald-700 dark:text-emerald-300" : "border border-slate-300 text-slate-500"
        )}
      >
        {active ? "Seleccionado" : "Elegir"}
      </span>
    </button>
  );

  return (
    <GuidedTarget id="create-movement-step2-general">
    <div className="grid gap-6">
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de movimiento</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card
            label="MD Trabajando"
            active={form.movementType === "MD_TRABAJANDO"}
            onClick={() => setForm((p) => ({ ...p, movementType: "MD_TRABAJANDO" }))}
          />
          <Card
            label="Remolcada"
            active={form.movementType === "REMOLCADA"}
            onClick={() => setForm((p) => ({ ...p, movementType: "REMOLCADA" }))}
          />
        </div>
        {errors.movementType && <div className="mt-1 text-xs text-rose-600">{errors.movementType}</div>}
      </div>

      <div className="grid gap-6">
      {!isService && (
        <>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200"></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Norte"
                active={form.polo === "NORTE"}
                disabled={form.cabinPosition !== "Sin_Solicitar" || form.chimneyPosition !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.polo === "NORTE") {
                    setForm((p) => ({ ...p, polo: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, polo: "NORTE", cabinPosition: "Sin_Solicitar", chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  }
                }}
              />
              <Card
                label="Sur"
                active={form.polo === "SUR"}
                disabled={form.cabinPosition !== "Sin_Solicitar" || form.chimneyPosition !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.polo === "SUR") {
                    setForm((p) => ({ ...p, polo: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, polo: "SUR", cabinPosition: "Sin_Solicitar", chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  }
                }}
              />
            </div>
            {(form.polo !== "Sin_Solicitar") && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de cabina</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Dentro"
                active={form.cabinPosition === "DENTRO"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.cabinPosition === "DENTRO") {
                    setForm((p) => ({ ...p, cabinPosition: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, cabinPosition: "DENTRO", polo: "Sin_Solicitar" }));
                  }
                }}
              />
              <Card
                label="Afuera"
                active={form.cabinPosition === "AFUERA"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.cabinPosition === "AFUERA") {
                    setForm((p) => ({ ...p, cabinPosition: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, cabinPosition: "AFUERA", polo: "Sin_Solicitar" }));
                  }
                }}
              />
            </div>
            {errors.cabinPosition && <div className="mt-1 text-xs text-rose-600">{errors.cabinPosition}</div>}
            {(form.cabinPosition !== "Sin_Solicitar") && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de chimenea</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Dentro"
                active={form.chimneyPosition === "DENTRO"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.chimneyPosition === "DENTRO") {
                    setForm((p) => ({ ...p, chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  } else {
                    setForm((p) => ({ ...p, chimneyPosition: "DENTRO", posicionChimenea: "DENTRO", polo: "Sin_Solicitar" }));
                  }
                }}
              />
              <Card
                label="Afuera"
                active={form.chimneyPosition === "AFUERA"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.chimneyPosition === "AFUERA") {
                    setForm((p) => ({ ...p, chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  } else {
                    setForm((p) => ({ ...p, chimneyPosition: "AFUERA", posicionChimenea: "AFUERA", polo: "Sin_Solicitar" }));
                  }
                }}
              />
            </div>
            {errors.chimneyPosition && <div className="mt-1 text-xs text-rose-600">{errors.chimneyPosition}</div>}
            {(form.chimneyPosition !== "Sin_Solicitar") && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
          </div>
        </>
      )}

      {form.movementType === "REMOLCADA" && (
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Dirección (remolcada)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Card
              label="Empujar"
              active={form.direccionEmpuje === "EMPUJAR"}
              onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "EMPUJAR", pushPull: "EMPUJAR" }))}
            />
            <Card
              label="Jalar"
              active={form.direccionEmpuje === "JALAR"}
              onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "JALAR", pushPull: "JALAR" }))}
            />
          </div>
          {errors.direccionEmpuje && <div className="mt-1 text-xs text-rose-600">{errors.direccionEmpuje}</div>}
        </div>
      )}
      </div>
    </div>
    </GuidedTarget>
  );
}
