import React from "react";
import type {
  Bucket,
  DayBucket,
  HourBucket,
  Kpis,
  RankingCliente,
  RankingEmpresa,
  RankingLocomotora,
  RankingOperador,
} from "../lib/types";
import { fmtInt, n } from "../lib/utils";
import SectionTitle from "../components/SectionTitle";

const toneMap: Record<string, { bar: string; soft: string }> = {
  indigo: { bar: "from-indigo-500 to-blue-400", soft: "bg-indigo-50 text-indigo-700" },
  emerald: { bar: "from-emerald-500 to-teal-400", soft: "bg-emerald-50 text-emerald-700" },
  amber: { bar: "from-amber-500 to-orange-400", soft: "bg-amber-50 text-amber-700" },
  rose: { bar: "from-rose-500 to-pink-400", soft: "bg-rose-50 text-rose-700" },
  sky: { bar: "from-sky-500 to-cyan-400", soft: "bg-sky-50 text-sky-700" },
};

function pickTag(text: string) {
  const t = text.toLowerCase();
  if (t.includes("pico") || t.includes("hora") || t.includes("dia")) return "Patron";
  if (t.includes("empresa") || t.includes("cliente")) return "Cuenta";
  if (t.includes("maquinista") || t.includes("operador")) return "Operador";
  if (t.includes("backlog")) return "Riesgo";
  if (t.includes("crit")) return "Critico";
  return "Insight";
}

export default function InsightsSection({
  insights,
  rankingEmpresas,
  rankingClientes,
  rankingOperadores,
  rankingLocomotoras,
  peakHora,
  peakDia,
  execMax,
  kpis,
}: {
  insights: string[];
  rankingEmpresas: RankingEmpresa[];
  rankingClientes: RankingCliente[];
  rankingOperadores: RankingOperador[];
  rankingLocomotoras: RankingLocomotora[];
  peakHora: HourBucket | null;
  peakDia: DayBucket | null;
  execMax: Bucket | null;
  kpis: Kpis;
}) {
  const topEmpresa = rankingEmpresas[0];
  const topCliente = rankingClientes[0];
  const topOperador = rankingOperadores[0];
  const topLoco = rankingLocomotoras[0];

  const badges = [
    {
      tone: "emerald",
      title: "Top Empresa",
      value: topEmpresa?.empresa ?? "--",
      sub: topEmpresa ? `${fmtInt.format(n(topEmpresa.totalMovimientos))} mov` : "Sin datos",
    },
    {
      tone: "indigo",
      title: "Top Cliente",
      value: topCliente?.clienteNombre ?? "--",
      sub: topCliente ? `${fmtInt.format(n(topCliente.totalMovimientos))} mov` : "Sin datos",
    },
    {
      tone: "sky",
      title: "Top Maquinista",
      value: topOperador?.operadorNombre ?? "--",
      sub: topOperador ? `${fmtInt.format(n(topOperador.totalMovimientos))} mov` : "Sin datos",
    },
    {
      tone: "amber",
      title: "Top Locomotora",
      value: topLoco?.locomotiveNumber ? String(topLoco.locomotiveNumber) : "--",
      sub: topLoco ? `${fmtInt.format(n(topLoco.totalMovimientos))} mov` : "Sin datos",
    },
    {
      tone: "rose",
      title: "Pico Horario",
      value: peakHora ? `${peakHora.hora}h` : "--",
      sub: peakHora ? `${fmtInt.format(n(peakHora.movimientos))} mov` : "Sin datos",
    },
    {
      tone: "indigo",
      title: "Dia Top",
      value: peakDia?.dia ?? "--",
      sub: peakDia ? `${fmtInt.format(n(peakDia.movimientos))} mov` : "Sin datos",
    },
    {
      tone: "amber",
      title: "Rango Critico",
      value: execMax?.label ?? "--",
      sub: execMax ? `${fmtInt.format(n(execMax.movimientos))} mov` : "Sin datos",
    },
    {
      tone: "rose",
      title: "Incidentes",
      value: kpis.totalIncidentes != null ? fmtInt.format(n(kpis.totalIncidentes)) : "--",
      sub: kpis.movimientosConIncidentePct != null ? `${kpis.movimientosConIncidentePct}% mov` : "Sin datos",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle title="Insights" subtitle="Lectura ejecutiva y focos de accion" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {badges.map((badge, idx) => {
          const tone = toneMap[badge.tone] ?? toneMap.indigo;
          return (
            <div
              key={`${badge.title}-${idx}`}
              className="relative overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]"
            >
              <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${tone.bar}`} />
              <div className="pl-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  {badge.title}
                </div>
                <div className="mt-2 text-lg font-black text-[var(--text)]">{badge.value}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{badge.sub}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {insights.length ? (
          insights.map((text, idx) => {
            const tag = pickTag(text);
            const tone = toneMap[["indigo", "emerald", "amber", "rose", "sky"][idx % 5]];
            return (
              <div
                key={`${idx}-${text.slice(0, 24)}`}
                className="relative overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]"
              >
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tone.bar}`} />
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>Insight {String(idx + 1).padStart(2, "0")}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tone.soft}`}>{tag}</span>
                </div>
                <div className="mt-3 text-base font-semibold text-[var(--text)]">{text}</div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)] shadow-[var(--shadow)]">
            Sin insights para este periodo.
          </div>
        )}
      </section>
    </div>
  );
}
