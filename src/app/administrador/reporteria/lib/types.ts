export type PeriodoUI = "dia" | "semana" | "mes" | "bimestre" | "semestre" | "anual";
export type PeriodoBack = "DIA" | "SEMANA" | "MES" | "BIMESTRE" | "SEMESTRE" | "ANUAL";

export type Kpis = Partial<{
  totalMovimientos: number;
  totalConInicioFin: number;
  totalConFin: number;
  totalSinFin: number;
  execMeanMin: number;
  execMedianMin: number;
  execP90Min: number;
  totalIncidentes: number;
  movimientosConIncidente: number;
  movimientosConIncidentePct: number;
  criticosLt2: number;
  criticosGte90: number;
  criticosTotal: number;
  locomotorasCritLt2: number;
  locomotorasCritGte90: number;
  cancelados: number;
  canceladosConIncidente: number;
  esperaMeanMin: number;
  esperaMedianMin: number;
  esperaP90Min: number;
  esperaOkPct: number;
  leadMeanMin: number;
  leadMedianMin: number;
  leadP90Min: number;
  leadOkPct: number;
  variabilidadExecRatio: number;
  indiceOperativo: number;
}>;

export type Bucket = { label: string; movimientos: number; pct?: number };
export type HourBucket = { hora: string | number; movimientos: number };
export type DayBucket = { dia: string; movimientos: number };
export type HourIncidents = { hora: string | number; incidentes: number };
export type DayIncidents = { dia: string; incidentes: number };

export type RankingOperador = {
  operadorNombre: string;
  operadorId?: number;
  operadorRol?: string;
  totalMovimientos: number;
  conInicioFin?: number;
  m0_9: number;
  m10_89: number;
  gte90: number;
  lt2: number;
  incidentesTotal: number;
  incidentesPct?: number;
  criticosTotal?: number;
  criticosPct?: number;
};
export type RankingLocomotora = {
  locomotiveNumber: string | number;
  totalMovimientos: number;
  conInicioFin?: number;
  m0_9: number;
  m10_89: number;
  gte90: number;
  lt2: number;
  incidentesTotal: number;
  incidentesPct?: number;
  criticosTotal?: number;
  criticosPct?: number;
  empresas?: string[];
};
export type RankingEmpresa = { empresa: string; totalMovimientos: number; incidentesTotal: number; incidentesPct?: number };
export type RankingCliente = { clienteNombre: string; totalMovimientos: number; incidentesTotal: number; incidentesPct?: number };
export type RankingSupervisor = { supervisorNombre: string; totalMovimientos: number; incidentesTotal: number; incidentesPct?: number; criticosTotal?: number; criticosPct?: number };
export type RankingCoordinador = { coordinadorNombre: string; totalMovimientos: number; incidentesTotal: number; incidentesPct?: number; criticosTotal?: number; criticosPct?: number };
export type RankingLocalidad = { localidad: string; totalMovimientos: number; incidentesTotal: number; incidentesPct?: number };
export type TopLocoIncidentes = {
  locomotiveNumber: string | number;
  incidentesTotal: number;
  movimientos: number;
  empresas?: string[];
};
export type TopIncidente = { id: number; empresa?: string; incidentesCount?: number; locomotiveNumber?: number | string };
export type TopCritico = {
  id: number;
  empresa?: string;
  localidad?: string;
  estado?: string;
  locomotiveNumber?: number | string;
  fechaSolicitudMX?: string;
  fechaFinMX?: string;
  tramoMX?: string;
  minSolicitudAFin?: number | null;
  minSolicitudAInicio?: number | null;
  minInicioAFin?: number | null;
  execBucket?: string;
  execLt2?: boolean;
  execGte90?: boolean;
  incidentesCount?: number;
};

export type Meta = Partial<{
  periodo: string;
  etiqueta: string;
  fechaLocal: string;
  tz: string;
  rangoUTC: { desde: string; hastaExclusivo: string };
  rangoLocal: { desde: string; hastaExclusivo: string };
}>;
export type IncidentesSummary = Partial<{ porEstado: Record<string, number> }>;

export type Reporte = Partial<{
  meta: Meta;
  kpis: Kpis;
  ejecucionBuckets: Bucket[];
  movimientosPorHora: HourBucket[];
  movimientosPorDiaSemana: DayBucket[];
  incidentesPorHora: HourIncidents[];
  incidentesPorDiaSemana: DayIncidents[];
  incidentes: IncidentesSummary;
  rankingOperadores: RankingOperador[];
  rankingLocomotoras: RankingLocomotora[];
  rankingEmpresas: RankingEmpresa[];
  rankingClientes: RankingCliente[];
  rankingSupervisores: RankingSupervisor[];
  rankingCoordinadores: RankingCoordinador[];
  rankingLocalidades: RankingLocalidad[];
  topLocomotorasIncidentes: TopLocoIncidentes[];
  topCriticos: TopCritico[];
  topIncidentes: TopIncidente[];
  insights: string[];
}>;

export type Tab = "overview" | "operaciones" | "incidentes" | "rankings" | "insights";
export type ReportKey = "general" | "cumplimiento" | "traficoCliente" | "turnos" | "maquinistas" | "comparativo";

export type Empresa = { id: number; nombre: string };
export type Localidad = { id: number; nombre: string; empresaId?: number | null; estado?: string };
