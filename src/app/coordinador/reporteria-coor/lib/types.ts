export type PeriodoUI = "dia" | "semana" | "mes" | "bimestre" | "semestre" | "anual";
export type PeriodoBack = "DIA" | "SEMANA" | "MES" | "BIMESTRE" | "SEMESTRE" | "ANUAL";

export type Kpis = Partial<{
  totalMovimientos: number;
  totalConInicioFin: number;
  totalConFin: number;
  totalSinFin: number;
  totalIncidentes: number;
  movimientosConIncidente: number;
  movimientosConIncidentePct: number;
  cancelados: number;
  canceladosConIncidente: number;
}>;

export type HourBucket = { hora: string | number; movimientos: number };
export type DayBucket = { dia: string; movimientos: number };
export type HourIncidents = { hora: string | number; incidentes: number };
export type DayIncidents = { dia: string; incidentes: number };
export type TopEmpresa = { empresa: string; totalMovimientos: number; incidentesTotal: number; incidentesPct?: number };
export type TopLocomotora = {
  locomotiveNumber: string | number;
  totalMovimientos: number;
  incidentesTotal: number;
  estados?: Record<string, number>;
};

export type Reporte = Partial<{
  kpis: Kpis;
  movimientosPorHora: HourBucket[];
  movimientosPorDiaSemana: DayBucket[];
  incidentesPorHora: HourIncidents[];
  incidentesPorDiaSemana: DayIncidents[];
  estadosGeneral: Record<string, number>;
  topEmpresas: TopEmpresa[];
  topLocomotoras: TopLocomotora[];
}>;

export type Tab = "overview" | "operaciones" | "incidentes" | "rankings";

export type Empresa = { id: number; nombre: string };
export type Localidad = { id: number; nombre: string; empresaId?: number | null; estado?: string };
