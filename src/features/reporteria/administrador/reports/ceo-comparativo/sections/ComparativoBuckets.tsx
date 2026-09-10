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

type Bucket = { label?: string; movimientos?: number };

export default function ComparativoBuckets({
  actual,
  anterior,
}: {
  actual: Bucket[];
  anterior: Bucket[];
}) {
  const data = useMemo(() => {
    const map = new Map<string, { label: string; actual: number; anterior: number }>();
    actual.forEach((b) => {
      const label = b.label ?? "";
      map.set(label, { label, actual: Number(b.movimientos ?? 0), anterior: 0 });
    });
    anterior.forEach((b) => {
      const label = b.label ?? "";
      const cur = map.get(label) ?? { label, actual: 0, anterior: 0 };
      cur.anterior = Number(b.movimientos ?? 0);
      map.set(label, cur);
    });
    return Array.from(map.values());
  }, [actual, anterior]);

  if (!data.length) return null;

  return (
    <ChartCard title="Ejecución comparativa" subtitle="Rangos 0–9, 10–89, 90+" accent="sky">
      <div className="chart-block h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="anterior" name="Anterior" fill="#94a3b8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
