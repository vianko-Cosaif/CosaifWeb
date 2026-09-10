// Contratos de datos de los reportes ejecutivos, compartidos por consultas y vistas.
import type { Reporte, Bucket } from "../lib/types";

export type ComparativoResumenDeltaMetric = {
  actual?: number;
  anterior?: number;
  delta?: number;
  deltaPct?: number;
};
export type ComparativoResumenProps = {
  resumen: Record<string, ComparativoResumenDeltaMetric> | undefined;
};

export type ComparativoCambiosCambioEmpresa = { empresa?: string; actual?: number; anterior?: number; delta?: number; deltaPct?: number };
export type ComparativoCambiosCambioCliente = { clienteNombre?: string; actual?: number; anterior?: number; delta?: number; deltaPct?: number };
export type ComparativoCambiosProps = {
  cambiosEmpresas: ComparativoCambiosCambioEmpresa[];
  cambiosClientes: ComparativoCambiosCambioCliente[];
};

export type ComparativoReportData = Reporte & {
  resumen?: ComparativoResumenProps["resumen"];
  cambiosEmpresas?: ComparativoCambiosProps["cambiosEmpresas"];
  cambiosClientes?: ComparativoCambiosProps["cambiosClientes"];
  actual?: { ejecucionBuckets?: Bucket[] };
  anterior?: { ejecucionBuckets?: Bucket[] };
};


export type CumplimientoEstadosProps = {
  estados: Record<string, number> | undefined;
};

export type CumplimientoSegmentacionSegmento = {
  key?: string;
  nombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  incidentesTotal?: number;
  criticosTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};
export type CumplimientoSegmentacionProps = {
  porEmpresa: CumplimientoSegmentacionSegmento[];
  porLocalidad: CumplimientoSegmentacionSegmento[];
  porTurno: CumplimientoSegmentacionSegmento[];
};

export type CumplimientoReportData = Reporte & {
  estadosGeneral?: CumplimientoEstadosProps["estados"];
  porEmpresa?: CumplimientoSegmentacionProps["porEmpresa"];
  porLocalidad?: CumplimientoSegmentacionProps["porLocalidad"];
  porTurno?: CumplimientoSegmentacionProps["porTurno"];
};

export type MaquinistasRankingSectionOperadorRow = {
  operadorId?: number;
  operadorNombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  execMeanMin?: number;
  execP90Min?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};
export type MaquinistasRankingSectionProps = { operadores: MaquinistasRankingSectionOperadorRow[] };

export type MaquinistasAgrupadosSectionOperadorRow = {
  operadorId?: number;
  operadorNombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  execMeanMin?: number;
  execP90Min?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};
export type MaquinistasAgrupadosSectionGrupo = {
  key?: string;
  nombre?: string;
  operadores?: MaquinistasAgrupadosSectionOperadorRow[];
};
export type MaquinistasAgrupadosSectionProps = {
  porEmpresa: MaquinistasAgrupadosSectionGrupo[];
  porLocalidad: MaquinistasAgrupadosSectionGrupo[];
};

export type MaquinistasReportData = Reporte & {
  rankingOperadores?: MaquinistasRankingSectionProps["operadores"];
  operadoresPorEmpresa?: MaquinistasAgrupadosSectionProps["porEmpresa"];
  operadoresPorLocalidad?: MaquinistasAgrupadosSectionProps["porLocalidad"];
};

export type TraficoClientesSectionClienteRow = {
  clienteId?: number;
  clienteNombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  incidentesTotal?: number;
  criticosTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};
export type TraficoClientesSectionEmpresaRow = {
  empresa?: string;
  totalMovimientos?: number;
  clientesUnicos?: number;
  incidentesTotal?: number;
};
export type TraficoClientesSectionProps = {
  topMovimientos: TraficoClientesSectionClienteRow[];
  topIncidentes: TraficoClientesSectionClienteRow[];
  clientes: TraficoClientesSectionClienteRow[];
  porEmpresa: TraficoClientesSectionEmpresaRow[];
};

export type TraficoClienteReportData = Reporte & {
  topClientesMovimientos?: TraficoClientesSectionProps["topMovimientos"];
  topClientesIncidentes?: TraficoClientesSectionProps["topIncidentes"];
  clientes?: TraficoClientesSectionProps["clientes"];
  porEmpresa?: TraficoClientesSectionProps["porEmpresa"];
  estadosGeneral?: CumplimientoEstadosProps["estados"];
};

export type TurnosResumenTurno = {
  turnoId?: string;
  turnoLabel?: string;
  turnoRango?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};
export type TurnosResumenProps = { turnos: TurnosResumenTurno[] };

export type TurnosOperadoresOperador = {
  operadorId?: number;
  operadorNombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
};
export type TurnosOperadoresGrupoTurno = {
  turnoId?: string;
  turnoLabel?: string;
  turnoRango?: string;
  operadores?: TurnosOperadoresOperador[];
};
export type TurnosOperadoresProps = { grupos: TurnosOperadoresGrupoTurno[] };

export type TurnosReportData = Reporte & {
  turnos?: TurnosResumenProps["turnos"];
  rankingOperadoresPorTurno?: TurnosOperadoresProps["grupos"];
};

