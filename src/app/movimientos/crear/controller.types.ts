import type { Dispatch, SetStateAction } from "react";
import type {
  Empresa,
  Localidad,
  MovementFormData,
  Rol,
  Seccion,
  Via,
} from "../movimientos.shared";
import type {
  TornoMedicionState,
  TornoMeasurementField,
  TornoMeasurementPart,
  TornoWheelCount,
  TornoWheelPosition,
} from "./tornoMedicion.types";

/**
 * MODULO: controller.types
 *
 * Responsabilidad:
 * - Definir el contrato tipado comun del flujo "crear movimiento".
 * - Evitar que cada archivo redefina tipos ad-hoc.
 *
 * Este archivo NO:
 * - Ejecuta logica.
 * - Lee cookies/localStorage.
 * - Hace llamadas HTTP.
 *
 * Relaciones:
 * - Consumido por: useCrearMovimientoController, dominio y sub-hooks.
 * - Depende de: tipos base del dominio de movimientos (movimientos.shared).
 */

/** Paso del wizard de creacion. */
export type CrearMovimientoStep = 1 | 2 | 3 | 4;
/** Modo de seleccion de vias cuando se activa un servicio. */
export type SelectionMode = "de_via" | "para_via";

/** Estado de bloqueo visual de locomotora por seccion ocupada. */
export type LocomotoraBloqueada = {
  movimientoId: number;
  viaId: number;
  numero: number;
};

/** Forma minima de sesion de usuario requerida por el controlador. */
export type UserSession = {
  id?: number;
  empresaId?: number | null;
  empresa?: { id?: number; nombre?: string } | null;
} | null;

/** IDs normalizados/resueltos antes de construir payload de envio. */
export type ResolvedIds = {
  empresaId: number;
  creadoPorId: number;
  localidadId: number;
};

/**
 * Contrato publico del controlador de "Crear Movimiento".
 * Mantiene el componente de pantalla enfocado en presentacion.
 */
export interface CrearMovimientoController {
  /* Estado principal del wizard */
  step: CrearMovimientoStep;
  setStep: Dispatch<SetStateAction<CrearMovimientoStep>>;
  form: MovementFormData;
  setForm: Dispatch<SetStateAction<MovementFormData>>;
  sending: boolean;
  errors: Record<string, string>;
  banner: string | null;

  /* Catalogos y datos dependientes */
  empresas: Empresa[];
  localidades: Localidad[];
  vias: Via[];
  sectionsByVia: Record<number, Seccion[]>;
  secLoading: Record<number, boolean>;

  /* Sesion y permisos */
  rol: Rol;
  canManageAll: boolean;
  userCompanyName: string;

  /* Estado de UI del Step 1 */
  showFromOpts: boolean;
  setShowFromOpts: Dispatch<SetStateAction<boolean>>;
  showToOpts: boolean;
  setShowToOpts: Dispatch<SetStateAction<boolean>>;
  selectionMode: SelectionMode;
  setSelectionMode: Dispatch<SetStateAction<SelectionMode>>;
  fromSection?: number;
  setToSection: Dispatch<SetStateAction<number | undefined>>;
  toSection?: number;
  locoLockedBy: LocomotoraBloqueada | null;
  setLocoLockedBy: Dispatch<SetStateAction<LocomotoraBloqueada | null>>;
  tornoMedicion: TornoMedicionState;
  setTornoWheelCount: (count: TornoWheelCount) => void;
  updateTornoMedicion: (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    part: TornoMeasurementPart,
    value: string
  ) => void;
  clearTornoMedicion: () => void;
  hasTornoPdfStep: boolean;
  tornoStep2Completed: boolean;
  tornoMovimientoId: number | null;
  tornoPdfSending: boolean;
  tornoPdfStatus: string | null;
  generateTornoPdf: () => Promise<void>;
  goBackToTornoMedicion: () => void;

  /* Estado de conectividad/sincronizacion */
  online: boolean;
  pendingCount: number;

  /* Acciones de dominio */
  flushOutbox: () => Promise<void>;
  submit: () => Promise<void>;
  validate1: () => boolean;
  validate2: () => boolean;
  tapToggle: (key: string, onSingle: () => void, onDouble: () => void) => void;
  ensureSections: (viaId: number) => Promise<void>;
  selectFromSection: (s: Seccion) => Promise<void>;
  viaName: (id?: number | null) => string;

  /* Datos derivados para la vista */
  isService: boolean;
  label: string;
  lockedClienteMissingData: boolean;

  /* Navegacion del wizard */
  goSalir: () => void;
  goPrev: () => void;
  goNext: () => void;
  clearForm: () => void;
  clearOutbox: () => void;
}
