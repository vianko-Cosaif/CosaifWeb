// Synthetic companies/localities deliberately overlap to exercise scope boundaries.
export const empresas = [
  { id: 3, nombre: "Empresa de prueba" },
  { id: 4, nombre: "Empresa invitada" },
];
export const localidades = [
  { id: 1, nombre: "Guadalajara" },
  { id: 2, nombre: "Otra localidad" },
];
const movement = (id, empresaId, localidadId, estado) => ({
  id,
  empresaId,
  localidadId,
  estado,
  locomotiveNumber: `FXE-${id}`,
  empresa: empresas.find((item) => item.id === empresaId),
  localidad: localidades.find((item) => item.id === localidadId),
  viaOrigen: { id: 1, nombre: "Vía 1" },
  viaDestino: { id: 2, nombre: "Vía 2" },
  prioridad: "BAJA",
  fechaSolicitud: "2026-09-10T12:00:00Z",
  fechaInicio: estado === "CONCLUIDO" ? "2026-09-10T13:00:00Z" : null,
  fechaFin: estado === "CONCLUIDO" ? "2026-09-10T14:00:00Z" : null,
  instrucciones: `Instrucción privada ${id}`,
  lavado: false,
  torno: false,
});
export const movimientos = [
  movement(1101, 3, 1, "SOLICITADO"),
  movement(1102, 4, 1, "EN_PROCESO"),
  movement(1103, 4, 2, "SOLICITADO"),
  movement(2101, 3, 1, "CONCLUIDO"),
  movement(2102, 4, 1, "CONCLUIDO"),
  movement(2103, 3, 2, "CONCLUIDO"),
];
export const rondas = movimientos.map((movimiento, index) => ({
  id: 3000 + index,
  movimientoId: movimiento.id,
  movimiento,
  empresa: movimiento.empresa,
  localidadId: movimiento.localidadId,
  rondaNumero: 1,
  orden: index + 1,
  concluido: movimiento.estado === "CONCLUIDO",
}));

// Filter only by the actual upstream query. Applying the logged-in user's scope here
// would hide a missing company/locality constraint in the real BFF under test.
export function inRequestedScope(row, params) {
  return ["empresaId", "localidadId"].every(
    (field) =>
      !params.has(field) ||
      Number(params.get(field)) === Number(row[field] ?? row.movimiento?.[field]),
  );
}

export const commercialAnalytics = {
  meta: {
    tz: "America/Mexico_City",
    months: 1,
    range: { from: "2026-09-01", toExclusive: "2026-10-01" },
    previousRange: { from: "2026-08-01", toExclusive: "2026-09-01" },
    reference: "2026-09",
    referenceDate: "2026-09-17",
    period: "MONTH",
    periodLabel: "Septiembre 2026",
    torreonAvailable: false,
    readOnly: true,
  },
  catalogs: {
    companies: empresas,
    localities: localidades.map((item) => ({ ...item, estado: "Jalisco" })),
  },
  kpis: {
    operations: 1,
    completed: 1,
    cancelled: 0,
    stopped: 0,
    incidents: 0,
    natural: 1,
    arrastre: 0,
    wagons: 0,
    wash: 0,
    turning: 0,
    currentMonth: 1,
    previousMonth: 1,
    monthlyGrowthPct: 0,
    selectedPeriod: 1,
    previousPeriod: 1,
    periodGrowthPct: 0,
    completedGrowthPct: 0,
  },
  trend: [],
  currentBreakdown: [],
  contractBreakdown: [],
  contractTrend: [],
  clients: [],
  yards: [],
  operations: {
    data: [
      {
        key: "e2e-2101",
        reference: "E2E-COM-2101",
        sourceSystem: "COSAIF",
        origin: "NATURAL",
        sourceId: "2101",
        empresaId: 3,
        empresa: empresas[0].nombre,
        localidadId: 1,
        localidad: localidades[0].nombre,
        locomotiveNumber: 2101,
        wagons: 0,
        status: "CONCLUIDO",
        completed: true,
        cancelled: false,
        stopped: false,
        services: ["MOVIMIENTO"],
        requestedAt: "2026-09-10T12:00:00Z",
        completedAt: "2026-09-10T14:00:00Z",
        operationAt: "2026-09-10T12:00:00Z",
        incidents: 0,
      },
    ],
    meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  },
};
