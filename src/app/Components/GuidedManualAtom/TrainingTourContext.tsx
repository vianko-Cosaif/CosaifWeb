"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Movement } from "@/app/Components/movimientos/useMovimientos";
import type { MovementFormData } from "@/app/movimientos/movimientos.shared";
import {
  TRAINING_CREATED_MOVEMENT_ID,
  TRAINING_MOVEMENT_ID,
  TRAINING_PAST_MOVEMENT_ID,
  isTrainingMovementId,
} from "@/lib/routePolicy";
import type { TrainingRole } from "./trainingRoles";

export {
  TRAINING_CREATED_MOVEMENT_ID,
  TRAINING_INCIDENT_ID,
  TRAINING_MOVEMENT_ID,
  TRAINING_PAST_MOVEMENT_ID,
  TRAINING_PAST_ROUND_ID,
  TRAINING_ROUND_ID,
} from "@/lib/routePolicy";

export type TrainingIncidentStatus = "ABIERTO" | "RESUELTO" | "OMITIDO";
export type TrainingScenario = "natural" | "torno";

type PersistedTrainingState = {
  active: boolean;
  role: TrainingRole;
  roleBase: string;
  trainingScenario: TrainingScenario;
  movements: Movement[];
  incidentStatus: TrainingIncidentStatus;
  incidentComment: string;
  roundOrder: number[];
  updatedAt: number;
};

type TrainingTourContextValue = PersistedTrainingState & {
  start: (role: TrainingRole, roleBase: string, scenario?: TrainingScenario) => void;
  finish: () => void;
  reset: () => void;
  prepareRoundsPractice: () => void;
  createMovement: (form: MovementFormData) => Movement;
  updateMovement: (id: number, patch: Partial<Movement>) => void;
  cancelMovement: (id: number, reason: string) => void;
  reorderMovements: (orderedIds: number[]) => void;
  resolveIncident: (action: "resolve" | "skip", comment?: string) => void;
  getMovement: (id: number | string) => Movement | null;
  isTrainingMovement: (id: number | string | null | undefined) => boolean;
};

const TRAINING_MOVEMENT_IDS = new Set([
  TRAINING_MOVEMENT_ID,
  TRAINING_PAST_MOVEMENT_ID,
  TRAINING_CREATED_MOVEMENT_ID,
]);
const TRAINING_ROLES: TrainingRole[] = [
  "ADMINISTRADOR",
  "COMERCIAL",
  "COORDINADOR",
  "SUPERVISOR",
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
];

const TRAINING_VIA_NAMES: Record<string, string> = {
  "91101": "Vía 1",
  "91102": "Vía 2",
  "91103": "Vía 3",
  "91104": "Vía 4",
};

function trainingViaName(value: string | number | null | undefined, fallback: string) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return fallback;
  return TRAINING_VIA_NAMES[normalizedValue] ?? `Vía ${normalizedValue}`;
}

function safeTrainingRole(value: unknown): TrainingRole {
  const role = String(value || "").trim().toUpperCase() as TrainingRole;
  return TRAINING_ROLES.includes(role) ? role : "CLIENTE";
}

function trainingBaseForRole(role: TrainingRole): string {
  if (role === "ADMINISTRADOR") return "/administrador";
  if (role === "COMERCIAL") return "/comercial";
  if (role === "COORDINADOR") return "/coordinador";
  if (role === "SUPERVISOR") return "/supervisor";
  if (role === "ARRASTRE_TORREON") return "/cliente/torreon";
  return "/cliente";
}

function nowIso() {
  return new Date().toISOString();
}

function buildSeedMovements(): Movement[] {
  return [
    {
      id: TRAINING_MOVEMENT_ID,
      idTecnico: TRAINING_MOVEMENT_ID,
      folioLocalidad: 204,
      folioLocalidadLabel: "SIM-MOV-204",
      locomotora: "SIM-L204",
      localidadId: 1,
      localidadNombre: "Localidad de capacitación",
      viaOrigen: "Vía 2",
      viaDestino: "Vía 4",
      tipoAccion: "CAPACITACION",
      tipoMovimiento: "MD_TRABAJANDO",
      prioridad: "ALTA",
      estado: "SOLICITADO",
      clienteId: 91_001,
      clienteNombre: "Usuario de capacitación",
      supervisorId: null,
      supervisorNombre: "—",
      coordinadorId: null,
      coordinadorNombre: "—",
      operadorId: null,
      operadorNombre: "—",
      maquinistaId: null,
      maquinistaNombre: "—",
      empresaId: 91_001,
      empresaNombre: "Empresa de capacitación",
      fechaSolicitud: nowIso(),
      fechaInicio: null,
      fechaFin: null,
      instrucciones: "Registro ficticio para aprender a consultar, editar y ordenar.",
      incidenteGlobal: true,
      finalizado: false,
      lavado: false,
      torno: false,
      posicionCabina: "NORTE",
      posicionChimenea: "SUR",
      direccionEmpuje: "EMPUJAR",
    },
    {
      id: TRAINING_PAST_MOVEMENT_ID,
      idTecnico: TRAINING_PAST_MOVEMENT_ID,
      folioLocalidad: 119,
      folioLocalidadLabel: "SIM-MOV-119",
      locomotora: "SIM-L119",
      localidadId: 1,
      localidadNombre: "Localidad de capacitación",
      viaOrigen: "Vía 1",
      viaDestino: "Torno",
      tipoAccion: "CAPACITACION",
      tipoMovimiento: "REMOLCADA",
      prioridad: "BAJA",
      estado: "CONCLUIDO",
      clienteId: 91_001,
      clienteNombre: "Usuario de capacitación",
      supervisorId: 91_004,
      supervisorNombre: "Supervisor SIM",
      coordinadorId: 91_003,
      coordinadorNombre: "Coordinador SIM",
      operadorId: 91_005,
      operadorNombre: "Operador SIM",
      maquinistaId: 91_006,
      maquinistaNombre: "Maquinista SIM",
      empresaId: 91_001,
      empresaNombre: "Empresa de capacitación",
      fechaSolicitud: new Date(Date.now() - 7_200_000).toISOString(),
      fechaInicio: new Date(Date.now() - 5_400_000).toISOString(),
      fechaFin: new Date(Date.now() - 3_600_000).toISOString(),
      instrucciones: "Ejemplo terminado: abre el detalle para leer tiempos y responsables.",
      incidenteGlobal: false,
      finalizado: true,
      lavado: false,
      torno: true,
      posicionCabina: "SUR",
      posicionChimenea: "NORTE",
      direccionEmpuje: "JALAR",
    },
  ];
}

function buildRoundPracticeMovement(): Movement {
  const base = buildSeedMovements()[0];
  return {
    ...base,
    id: TRAINING_CREATED_MOVEMENT_ID,
    idTecnico: TRAINING_CREATED_MOVEMENT_ID,
    folioLocalidad: 305,
    folioLocalidadLabel: "SIM-MOV-305",
    locomotora: "SIM-L305",
    viaOrigen: "Vía 5",
    viaDestino: "Vía 7",
    prioridad: "BAJA",
    instrucciones: "Ejemplo ficticio para practicar orden y cancelación de una ronda.",
    incidenteGlobal: false,
    fechaSolicitud: nowIso(),
  };
}

function initialState(): PersistedTrainingState {
  return {
    active: false,
    role: "CLIENTE",
    roleBase: "/cliente",
    trainingScenario: "natural",
    movements: buildSeedMovements(),
    incidentStatus: "ABIERTO",
    incidentComment: "",
    roundOrder: [TRAINING_MOVEMENT_ID, TRAINING_PAST_MOVEMENT_ID],
    updatedAt: Date.now(),
  };
}

const TrainingTourContext = createContext<TrainingTourContextValue | null>(null);

export function TrainingTourProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedTrainingState>(() => initialState());

  const start = useCallback((role: TrainingRole, roleBase: string, scenario: TrainingScenario = "natural") => {
    void roleBase;
    const safeRole = safeTrainingRole(role);
    setState({
      ...initialState(),
      active: true,
      role: safeRole,
      // Nunca confiamos en una ruta recibida/restaurada para navegar.
      roleBase: trainingBaseForRole(safeRole),
      trainingScenario: scenario === "torno" ? "torno" : "natural",
      updatedAt: Date.now(),
    });
  }, []);

  const finish = useCallback(() => {
    setState((current) => ({ ...current, active: false, updatedAt: Date.now() }));
  }, []);

  const reset = useCallback(() => setState(initialState()), []);

  const prepareRoundsPractice = useCallback(() => {
    setState((current) => {
      const existing = current.movements.find((movement) => movement.id === TRAINING_CREATED_MOVEMENT_ID);
      const practiceMovement = existing ?? buildRoundPracticeMovement();
      return {
        ...current,
        movements: [
          practiceMovement,
          ...current.movements.filter((movement) => movement.id !== TRAINING_CREATED_MOVEMENT_ID),
        ],
        // Replica el estado que deja el capítulo Crear: SIM-305 inicia arriba,
        // baja un lugar y después queda como segunda tarjeta para cancelarla.
        roundOrder: [
          TRAINING_CREATED_MOVEMENT_ID,
          TRAINING_MOVEMENT_ID,
          ...current.roundOrder.filter((id) => (
            id !== TRAINING_CREATED_MOVEMENT_ID && id !== TRAINING_MOVEMENT_ID
          )),
        ],
        updatedAt: Date.now(),
      };
    });
  }, []);

  const createMovement = useCallback((form: MovementFormData) => {
    const movement: Movement = {
      id: TRAINING_CREATED_MOVEMENT_ID,
      idTecnico: TRAINING_CREATED_MOVEMENT_ID,
      folioLocalidad: 305,
      folioLocalidadLabel: form.service === "Torno" ? "SIM-TOR-305" : "SIM-MOV-305",
      locomotora: form.locomotiveNumber || "SIM-L305",
      localidadId: Number(form.selectedLocalityId) || 1,
      localidadNombre: "Localidad de capacitación",
      viaOrigen: trainingViaName(form.fromTrack, "Patio SIM"),
      viaDestino: trainingViaName(form.toTrack, form.service === "Torno" ? "Torno" : "Vía SIM"),
      tipoAccion: "CAPACITACION",
      tipoMovimiento: form.movementType || "MD_TRABAJANDO",
      prioridad: form.priority ? "ALTA" : "BAJA",
      estado: "SOLICITADO",
      clienteId: Number(form.clienteId) || 91_001,
      clienteNombre: "Usuario de capacitación",
      supervisorId: null,
      supervisorNombre: "—",
      coordinadorId: null,
      coordinadorNombre: "—",
      operadorId: null,
      operadorNombre: "—",
      maquinistaId: null,
      maquinistaNombre: "—",
      empresaId: Number(form.empresaId) || 91_001,
      empresaNombre: "Empresa de capacitación",
      fechaSolicitud: nowIso(),
      fechaInicio: null,
      fechaFin: null,
      instrucciones: form.comments?.trim() || "Movimiento creado durante la capacitación.",
      incidenteGlobal: false,
      finalizado: false,
      lavado: form.service === "Lavado",
      torno: form.service === "Torno",
      posicionCabina: form.cabinPosition || "Sin_Solicitar",
      posicionChimenea: form.chimneyPosition || "Sin_Solicitar",
      direccionEmpuje: form.direccionEmpuje || "Sin_Solicitar",
    };
    setState((current) => ({
      ...current,
      // El parámetro ?training=1 también puede abrirse tras una recarga. En
      // ese caso el formulario sigue siendo SIM y el resultado debe quedar
      // visible aunque el estado previo de la guía se haya perdido.
      active: true,
      movements: [movement, ...current.movements.filter((item) => item.id !== movement.id)],
      roundOrder: [movement.id, ...current.roundOrder.filter((id) => id !== movement.id)],
      trainingScenario: form.service === "Torno" ? "torno" : current.trainingScenario,
      updatedAt: Date.now(),
    }));
    return movement;
  }, []);

  const updateMovement = useCallback((id: number, patch: Partial<Movement>) => {
    if (!isTrainingMovementId(id)) return;
    setState((current) => ({
      ...current,
      movements: current.movements.map((movement) => movement.id === id ? {
        ...movement,
        ...patch,
        id: movement.id,
        idTecnico: movement.id,
      } : movement),
      updatedAt: Date.now(),
    }));
  }, []);

  const cancelMovement = useCallback((id: number, reason: string) => {
    if (!isTrainingMovementId(id)) return;
    setState((current) => ({
      ...current,
      movements: current.movements.map((movement) => movement.id === id ? {
        ...movement,
        estado: "CANCELADO",
        finalizado: true,
        fechaFin: nowIso(),
        instrucciones: `${movement.instrucciones || ""} [Capacitación: ${String(reason || "Sin motivo").slice(0, 500)}]`.trim(),
      } : movement),
      roundOrder: current.roundOrder.filter((movementId) => movementId !== id),
      updatedAt: Date.now(),
    }));
  }, []);

  const reorderMovements = useCallback((orderedIds: number[]) => {
    setState((current) => {
      const available = new Set(current.movements.map((movement) => movement.id));
      const seen = new Set<number>();
      const safeOrder = orderedIds
        .map(Number)
        .filter((id) => {
          if (!TRAINING_MOVEMENT_IDS.has(id) || !available.has(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      return { ...current, roundOrder: safeOrder, updatedAt: Date.now() };
    });
  }, []);

  const resolveIncident = useCallback((action: "resolve" | "skip", comment = "") => {
    setState((current) => ({
      ...current,
      incidentStatus: action === "resolve" ? "RESUELTO" : "OMITIDO",
      incidentComment: String(comment || "").slice(0, 2_000),
      updatedAt: Date.now(),
    }));
  }, []);

  const getMovement = useCallback(
    (id: number | string) => isTrainingMovementId(id)
      ? state.movements.find((movement) => movement.id === Number(id)) ?? null
      : null,
    [state.movements]
  );

  const isTrainingMovement = useCallback(
    (id: number | string | null | undefined) => id != null && isTrainingMovementId(id),
    []
  );

  const value = useMemo<TrainingTourContextValue>(() => ({
    ...state,
    start,
    finish,
    reset,
    prepareRoundsPractice,
    createMovement,
    updateMovement,
    cancelMovement,
    reorderMovements,
    resolveIncident,
    getMovement,
    isTrainingMovement,
  }), [
    state,
    start,
    finish,
    reset,
    prepareRoundsPractice,
    createMovement,
    updateMovement,
    cancelMovement,
    reorderMovements,
    resolveIncident,
    getMovement,
    isTrainingMovement,
  ]);

  return <TrainingTourContext.Provider value={value}>{children}</TrainingTourContext.Provider>;
}

export function useTrainingTour() {
  const context = useContext(TrainingTourContext);
  if (!context) throw new Error("useTrainingTour debe usarse dentro de TrainingTourProvider");
  return context;
}
