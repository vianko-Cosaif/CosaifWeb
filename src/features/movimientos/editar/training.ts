import type { Movement } from "@/features/movimientos/list/useMovimientos";
import { Direccion, Posicion, Via, Seccion, InfoEdicion } from "@/features/movimientos/movimientos.shared";

export const TRAINING_EDIT_VIAS: Via[] = [
  { id: 991_001, nombre: "1", lineaDeVida: null },
  { id: 991_002, nombre: "2", lineaDeVida: null },
  { id: 991_003, nombre: "3", lineaDeVida: null },
  { id: 991_004, nombre: "4", lineaDeVida: null },
  { id: 991_005, nombre: "Torno", lineaDeVida: null },
];

export const TRAINING_EDIT_SECTIONS: Record<number, Seccion[]> = Object.fromEntries(
  TRAINING_EDIT_VIAS.map((via) => [
    via.id,
    [1, 2, 3].map((numero) => ({
      id: via.id * 10 + numero,
      numero,
      nombre: `SIM-${numero}`,
      ocupada: false,
      movimientoId: null,
      movimiento: null,
    })),
  ])
);

export function trainingViaFor(value: Movement["viaOrigen"], fallbackId: number): Via {
  const normalized = String(value ?? "")
    .replace(/^v[ií]a\s*/i, "")
    .trim()
    .toLowerCase();
  return TRAINING_EDIT_VIAS.find((via) => String(via.nombre).toLowerCase() === normalized)
    ?? TRAINING_EDIT_VIAS.find((via) => via.id === fallbackId)
    ?? TRAINING_EDIT_VIAS[0];
}

export function trainingPosition(value: string): Posicion {
  return value === "DENTRO" || value === "AFUERA" ? value : "Sin_Solicitar";
}

export function trainingDirection(value: string): Direccion {
  return value === "EMPUJAR" || value === "JALAR" ? value : "Sin_Solicitar";
}

export function buildTrainingEditInfo(movement: Movement): InfoEdicion {
  const viaOrigen = trainingViaFor(movement.viaOrigen, 991_002);
  const viaDestino = trainingViaFor(movement.viaDestino, movement.torno ? 991_005 : 991_004);
  return {
    editable: true,
    restricciones: {
      motivo: null,
      estadosPermitidos: ["SOLICITADO", "DETENIDO", "EN_PROCESO", "CONCLUIDO"],
      mismaLocalidadParaVias: true,
    },
    movimiento: {
      id: movement.id,
      empresa: {
        id: movement.empresaId,
        nombre: movement.empresaNombre || "Empresa de capacitación",
      },
      localidad: {
        id: movement.localidadId,
        nombre: movement.localidadNombre || "Localidad de capacitación",
      },
      estado: movement.estado,
      finalizado: movement.finalizado,
      instrucciones: movement.instrucciones,
      locomotiveNumber: movement.locomotora as unknown as number,
      viaOrigen,
      viaDestino,
      tipoMovimiento: movement.tipoMovimiento === "REMOLCADA" ? "REMOLCADA" : "MD_TRABAJANDO",
      posicionCabina: trainingPosition(movement.posicionCabina),
      posicionChimenea: trainingPosition(movement.posicionChimenea),
      direccionEmpuje: trainingDirection(movement.direccionEmpuje),
      polo: "Sin_Solicitar",
      meta: { seccion: 2 },
      tornoMedidas: null,
      torno: movement.torno,
      Lavado: movement.lavado,
    },
    editableKeys: [
      "instrucciones",
      "locomotiveNumber",
      "viaOrigenId",
      "viaDestinoId",
      "tipoMovimiento",
      "posicionCabina",
      "posicionChimenea",
      "direccionEmpuje",
      "torno",
      "lavado",
      "polo",
    ],
  } as InfoEdicion;
}
