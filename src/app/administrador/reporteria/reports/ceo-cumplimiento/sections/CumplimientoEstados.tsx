"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "../../../components/ChartCard";
import CustomTooltip from "../../../components/CustomTooltip";
import SectionTitle from "../../../components/SectionTitle";

export default function CumplimientoEstados({
  estados,
}: {
  estados: Record<string, number> | undefined;
}) {
  const data = useMemo(() => {
    const entries = Object.entries(estados ?? {});
    return entries.map(([estado, total]) => ({ estado, total }));
  }, [estados]);

  if (!data.length) return null;

  return (
    <div className="space-y-4">
      <SectionTitle title="Estados Operativos" subtitle="Distribución general de estados" />
      <ChartCard title="Estados generales" subtitle="Volumen por estado" accent="emerald">
        <div className="chart-block h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
              <XAxis dataKey="estado" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" fill="#22c55e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
