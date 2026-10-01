"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  GitBranch,
  MapPinned,
  Route,
  Train,
  UserRound,
} from "lucide-react";
import {
  BarChartBox,
  ChartPanel,
  Kpi,
  LineChartBox,
  MetricGrid,
  Panel,
  PieChartBox,
  SimpleTable,
  avgPct,
  sumBy,
} from "../ReportKit";

type ReportKey =
  | "carga"
  | "vias"
  | "turnos"
  | "usuarios"
  | "cumplimiento"
  | "incidentes"
  | "cronologia";

// Cada reporte trae columnas distintas desde backend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const CRONOLOGIA_PAGE_SIZE = 25;

function n(value: unknown) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function fmt(value: unknown) {
  return n(value).toLocaleString("es-MX");
}

function fmtPct(value: unknown) {
  return `${fmt(value)}%`;
}

function asArray<T = AnyRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeText(value: unknown, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

export function ReportContent({
  reportKey,
  report,
  accent,
  cronologiaPage,
  onCronologiaPageChange,
}: {
  reportKey: ReportKey;
  report: AnyRecord;
  accent: string;
  cronologiaPage: number;
  onCronologiaPageChange: (page: number) => void;
}) {
  if (reportKey === "carga") return <CargaReport report={report} accent={accent} />;
  if (reportKey === "vias") return <ViasReport report={report} accent={accent} />;
  if (reportKey === "turnos") return <TurnosReport report={report} />;
  if (reportKey === "usuarios") return <UsuariosReport report={report} accent={accent} />;
  if (reportKey === "cumplimiento") return <CumplimientoReport report={report} accent={accent} />;
  if (reportKey === "incidentes") return <IncidentesReport report={report} accent={accent} />;
  return (
    <CronologiaReport
      report={report}
      page={cronologiaPage}
      onPageChange={onCronologiaPageChange}
    />
  );
}

function CargaReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const porDia = asArray(report.movimientosPorDia);
  const topVias = asArray(report.vias).slice(0, 10);
  const topLocos = asArray(report.locomotoras).slice(0, 10);
  const usuarios = asArray(report.usuariosSolicitantes).slice(0, 8);
  const servicios = resumen.servicios ?? {};

  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={Train} label="Movimientos" value={fmt(resumen.totalMovimientos)} sub="Total del periodo" />
        <Kpi icon={GitBranch} label="Locomotoras" value={fmt(resumen.totalLocomotoras)} sub="Unidades únicas" />
        <Kpi icon={MapPinned} label="Vías tocadas" value={fmt(resumen.totalVias)} sub="Origen o destino" />
      </MetricGrid>
      <ChartPanel title="Movimientos por día">
        <LineChartBox data={porDia} xKey="fecha" yKey="movimientos" stroke={accent} />
      </ChartPanel>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_0.8fr]">
        <Panel title="Vías con mayor carga">
          <SimpleTable
            rows={topVias}
            columns={[
              ["Vía", (r) => safeText(r.via)],
              ["Usos", (r) => fmt(r.totalUsos), "right"],
              ["Origen", (r) => fmt(r.comoOrigen), "right"],
              ["Destino", (r) => fmt(r.comoDestino), "right"],
            ]}
          />
        </Panel>
        <Panel title="Locomotoras más movidas">
          <SimpleTable
            rows={topLocos}
            columns={[
              ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
              ["Mov.", (r) => fmt(r.movimientos), "right"],
              ["Vías", (r) => fmt(r.viasUsadas), "right"],
              ["Días", (r) => fmt(r.diasActivos), "right"],
            ]}
          />
        </Panel>
        <Panel title="Servicios">
          <PieChartBox
            data={[
              { name: "Torno", value: n(servicios.torno) },
              { name: "Lavado", value: n(servicios.lavado) },
              { name: "Ambos", value: n(servicios.tornoLavado) },
              { name: "Sin servicio", value: n(servicios.sinServicio) },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Usuarios solicitantes">
        <SimpleTable
          rows={usuarios}
          columns={[
            ["Usuario", (r) => safeText(r.nombre)],
            ["Solicitudes", (r) => fmt(r.solicitudes), "right"],
            ["Loc.", (r) => fmt(r.locomotorasUnicas), "right"],
            ["Vías", (r) => fmt(r.viasRelacionadas), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function ViasReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const vias = asArray(report.vias);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={Route} label="Vías y servicios" value={fmt(resumen.totalVias)} sub="Con actividad" />
        <Kpi icon={Train} label="Entradas" value={fmt(resumen.totalEntradas)} sub="Destino" />
        <Kpi icon={Activity} label="Salidas" value={fmt(resumen.totalSalidas)} sub="Origen" />
        <Kpi icon={AlertTriangle} label="Cancelados" value={fmt(resumen.cancelados)} sub={`${fmt(resumen.incidentes)} incidentes`} />
      </MetricGrid>
      <ChartPanel title="Vías y servicios más usados">
        <BarChartBox data={vias.slice(0, 12)} xKey="via" yKey="totalUsos" fill={accent} />
      </ChartPanel>
      <Panel title="Detalle por vía">
        <SimpleTable
          rows={vias}
          columns={[
            ["Vía", (r) => safeText(r.via)],
            ["Usos", (r) => fmt(r.totalUsos), "right"],
            ["Entradas", (r) => fmt(r.entradas), "right"],
            ["Salidas", (r) => fmt(r.salidas), "right"],
            ["Pend.", (r) => fmt(r.pendientes), "right"],
            ["Canc.", (r) => fmt(r.cancelados), "right"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function TurnosReport({ report }: { report: AnyRecord }) {
  const turnos = asArray(report.turnos);
  const total = turnos.reduce((acc, row) => acc + n(row.solicitados), 0);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={Train} label="Solicitados" value={fmt(total)} sub="Total turnos" />
        <Kpi icon={Clock3} label="Completos" value={fmtPct(avgPct(turnos, "conInicioFinPct"))} sub="Por turno" />
        <Kpi icon={AlertTriangle} label="Cancelados" value={fmt(sumBy(turnos, "cancelados"))} sub={`${fmt(sumBy(turnos, "incidentes"))} incidentes`} />
      </MetricGrid>
      <Panel title="Turno 1, 2 y 3">
        <SimpleTable
          rows={turnos}
          columns={[
            ["Turno", (r) => safeText(r.turnoLabel)],
            ["Solic.", (r) => fmt(r.solicitados), "right"],
            ["Inic.", (r) => fmt(r.iniciados), "right"],
            ["Finalizadas", (r) => fmt(r.finalizados), "right"],
            ["Completos", (r) => fmtPct(r.conInicioFinPct), "right"],
            ["Canc.", (r) => fmt(r.cancelados), "right"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function UsuariosReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const solicitantes = asArray(report.solicitantes);
  const actividad = asArray(report.actividadPorDia);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={UserRound} label="Solicitantes" value={fmt(solicitantes.length)} sub="Usuarios con solicitudes" />
        <Kpi icon={CheckCircle2} label="Finalizados" value={fmt(sumBy(solicitantes, "finalizados"))} sub="Desde solicitudes" />
        <Kpi icon={AlertTriangle} label="Cancelaciones" value={fmt(sumBy(solicitantes, "cancelaciones"))} sub="Registradas" />
      </MetricGrid>
      <ChartPanel title="Solicitudes por usuario">
        <BarChartBox data={solicitantes.slice(0, 10)} xKey="nombre" yKey="solicitudes" fill={accent} />
      </ChartPanel>
      <Panel title="Solicitudes creadas">
        <SimpleTable
          rows={solicitantes}
          columns={[
            ["Usuario", (r) => safeText(r.nombre)],
            ["Solicitudes", (r) => fmt(r.solicitudes), "right"],
            ["Finalizadas", (r) => fmt(r.finalizados), "right"],
            ["Canceladas", (r) => fmt(r.cancelaciones), "right"],
            ["T1", (r) => fmt(r.turnos?.T1), "right"],
            ["T2", (r) => fmt(r.turnos?.T2), "right"],
            ["T3", (r) => fmt(r.turnos?.T3), "right"],
          ]}
        />
      </Panel>
      <Panel title="Actividad por día">
        <SimpleTable
          rows={actividad}
          columns={[
            ["Fecha", (r) => safeText(r.fecha)],
            ["Día", (r) => safeText(r.diaSemana)],
            ["Solicitudes", (r) => fmt(r.solicitudes), "right"],
            ["Atendidos", (r) => fmt(r.atendidos), "right"],
            ["Finalizadas", (r) => fmt(r.finalizados), "right"],
            ["Canceladas", (r) => fmt(r.cancelaciones), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function CumplimientoReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const locos = asArray(report.porLocomotora);
  const turnos = asArray(report.porTurno);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={CheckCircle2} label="Terminados" value={fmt(resumen.terminadosCorrectamente)} sub={`${fmt(resumen.concluidosSinIncidente)} sin incidente`} />
        <Kpi icon={Clock3} label="Pendientes" value={fmt(resumen.pendientes)} sub="Activos" />
        <Kpi icon={AlertTriangle} label="Cancelados" value={fmt(resumen.cancelados)} sub="Del periodo" />
        <Kpi icon={Activity} label="Completos" value={fmtPct(resumen.conInicioFinPct)} sub="Con registro completo" />
      </MetricGrid>
      <ChartPanel title="Cumplimiento por turno">
        <BarChartBox data={turnos} xKey="turnoLabel" yKey="finalizados" fill={accent} />
      </ChartPanel>
      <Panel title="Cumplimiento por locomotora">
        <SimpleTable
          rows={locos}
          columns={[
            ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
            ["Total", (r) => fmt(r.totalMovimientos), "right"],
            ["Conc.", (r) => fmt(r.concluidos), "right"],
            ["Pend.", (r) => fmt(r.pendientes), "right"],
            ["Canc.", (r) => fmt(r.cancelados), "right"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function IncidentesReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const locos = asArray(report.porLocomotora);
  const vias = asArray(report.porVia);
  const turnos = asArray(report.porTurno);
  const detalle = asArray(report.detalle);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={AlertTriangle} label="Incidentes" value={fmt(resumen.totalIncidentes)} sub="Total" />
        <Kpi icon={Train} label="Mov. con incidente" value={fmt(resumen.movimientosConIncidente)} sub="Relacionados" />
        <Kpi icon={Clock3} label="Abiertos" value={fmt(resumen.incidentesAbiertos)} sub={`${fmt(resumen.incidentesResueltos)} resueltos`} />
        <Kpi icon={CheckCircle2} label="Canc. relacionadas" value={fmt(resumen.cancelacionesRelacionadas)} sub="Cancelado + incidente" />
      </MetricGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Incidentes por locomotora">
          <BarChartBox data={locos.slice(0, 10)} xKey="locomotiveNumber" yKey="incidentes" fill={accent} prefixX="L-" />
        </ChartPanel>
        <ChartPanel title="Incidentes por vía">
          <BarChartBox data={vias.slice(0, 10)} xKey="via" yKey="incidentes" fill="#ea580c" />
        </ChartPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Incidentes por turno">
          <SimpleTable
            rows={turnos}
            columns={[
              ["Turno", (r) => safeText(r.turnoLabel)],
              ["Inc.", (r) => fmt(r.incidentes), "right"],
              ["Mov.", (r) => fmt(r.movimientos), "right"],
              ["Canc.", (r) => fmt(r.cancelacionesRelacionadas), "right"],
            ]}
          />
        </Panel>
        <Panel title="Detalle de incidentes">
          <SimpleTable
            rows={detalle}
            columns={[
              ["Inc.", (r) => fmt(r.incidenteId), "right"],
              ["Mov.", (r) => fmt(r.movimientoId), "right"],
              ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
              ["Estado", (r) => safeText(r.estadoIncidente)],
              ["Vía", (r) => safeText(r.viaOrigen ?? r.viaDestino)],
              ["Turno", (r) => safeText(r.turnoLabel)],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function CronologiaReport({
  report,
  page,
  onPageChange,
}: {
  report: AnyRecord;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const movimientos = asArray(report.movimientos);
  const meta = report.detalleMeta ?? {};
  const currentPage = Math.max(1, n(meta.page ?? page));
  const totalPages = Math.max(1, n(meta.totalPages ?? 1));
  const total = n(meta.totalMovimientos ?? movimientos.length);
  const from = n(meta.from ?? (total ? (currentPage - 1) * CRONOLOGIA_PAGE_SIZE + 1 : 0));
  const to = n(meta.to ?? (total ? from + movimientos.length - 1 : 0));

  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={FileClock} label="Movimientos" value={fmt(total)} sub="Total del periodo" />
        <Kpi icon={CheckCircle2} label="Página" value={`${fmt(currentPage)} / ${fmt(totalPages)}`} sub="Desde backend" />
        <Kpi icon={Activity} label="Mostrados" value={fmt(meta.incluidos ?? movimientos.length)} sub="En esta página" />
        <Kpi icon={AlertTriangle} label="Rango" value={total ? `${fmt(from)}-${fmt(to)}` : "0"} sub="Registros visibles" />
      </MetricGrid>
      <Panel title="Línea de tiempo por movimiento">
        <SimpleTable
          rows={movimientos}
          columns={[
            ["ID", (r) => fmt(r.id), "right"],
            ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
            ["Estado", (r) => safeText(r.estadoActual)],
            ["Origen", (r) => safeText(r.viaOrigen)],
            ["Destino", (r) => safeText(r.viaDestino)],
            ["Servicio", (r) => safeText(r.servicio)],
            ["Solicitud", (r) => safeText(r.fechaSolicitud)],
            ["Inicio", (r) => safeText(r.fechaInicio)],
            ["Fin", (r) => safeText(r.fechaFin)],
            ["Línea", (r) => safeText(asArray<string>(r.linea).join(" -> ")), "wide"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          onPageChange={onPageChange}
        />
      </Panel>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {total ? `Mostrando ${fmt(from)}-${fmt(to)} de ${fmt(total)}` : "Sin registros para este periodo"}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {fmt(page)} / {fmt(totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
