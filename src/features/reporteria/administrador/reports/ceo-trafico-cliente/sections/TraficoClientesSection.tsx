"use client";

import type { TraficoClientesSectionProps, TraficoClientesSectionClienteRow } from "../../types";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";





export default function TraficoClientesSection({
  topMovimientos,
  topIncidentes,
  clientes,
  porEmpresa,
}: TraficoClientesSectionProps) {
  const clienteCols: { key: keyof TraficoClientesSectionClienteRow; label: string; format?: (v: unknown, row: TraficoClientesSectionClienteRow) => string }[] = [
    { key: "clienteNombre", label: "Cliente" },
    { key: "totalMovimientos", label: "Mov", format: (v: unknown) => fmtMaybeInt(v) },
    { key: "conInicioFin", label: "Con fin", format: (v: unknown) => fmtMaybeInt(v) },
    { key: "okPct", label: "OK %", format: (v: unknown) => fmtMaybePct(v) },
    { key: "incidentesTotal", label: "Inc", format: (v: unknown) => fmtMaybeInt(v) },
    { key: "criticosTotal", label: "Crit", format: (v: unknown) => fmtMaybeInt(v) },
    { key: "cancelados", label: "Canc", format: (v: unknown) => fmtMaybeInt(v) },
    { key: "canceladosConIncidente", label: "Canc+Inc", format: (v: unknown) => fmtMaybeInt(v) },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle title="Clientes" subtitle="Top y distribución por cliente" />

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
          <ConfigurableTable
            title="Top clientes (movimientos)"
            subtitle="Mayor volumen operativo"
            data={topMovimientos}
            accent="emerald"
            storageKey="ceo-trafico:top-mov"
            defaultSortKey="totalMovimientos"
            columns={clienteCols}
          />
        </div>
        <div className="col-span-12 xl:col-span-6">
          <ConfigurableTable
            title="Top clientes (incidentes)"
            subtitle="Clientes con mayor incidencia"
            data={topIncidentes}
            accent="rose"
            storageKey="ceo-trafico:top-inc"
            defaultSortKey="incidentesTotal"
            columns={clienteCols}
          />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <ConfigurableTable
            title="Clientes (detalle)"
            subtitle="Lista completa por cliente"
            data={clientes}
            accent="sky"
            storageKey="ceo-trafico:clientes"
            defaultSortKey="totalMovimientos"
            columns={clienteCols}
          />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <ConfigurableTable
            title="Empresas con tráfico"
            subtitle="Clientes únicos e incidencia"
            data={porEmpresa}
            accent="amber"
            storageKey="ceo-trafico:empresas"
            defaultSortKey="totalMovimientos"
            columns={[
              { key: "empresa", label: "Empresa" },
              { key: "totalMovimientos", label: "Mov", format: (v: unknown) => fmtMaybeInt(v) },
              { key: "clientesUnicos", label: "Clientes", format: (v: unknown) => fmtMaybeInt(v) },
              { key: "incidentesTotal", label: "Inc", format: (v: unknown) => fmtMaybeInt(v) },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
