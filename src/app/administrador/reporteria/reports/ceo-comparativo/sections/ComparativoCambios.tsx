"use client";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";

type CambioEmpresa = { empresa?: string; actual?: number; anterior?: number; delta?: number; deltaPct?: number };
type CambioCliente = { clienteNombre?: string; actual?: number; anterior?: number; delta?: number; deltaPct?: number };

export default function ComparativoCambios({
  cambiosEmpresas,
  cambiosClientes,
}: {
  cambiosEmpresas: CambioEmpresa[];
  cambiosClientes: CambioCliente[];
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Cambios por cuenta" subtitle="Variación por empresa y cliente" />
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
          <ConfigurableTable
            title="Cambios por empresa"
            subtitle="Actual vs anterior"
            data={cambiosEmpresas}
            accent="emerald"
            storageKey="ceo-comparativo:empresas"
            defaultSortKey="delta"
            columns={[
              { key: "empresa", label: "Empresa" },
              { key: "actual", label: "Actual", format: (v: any) => fmtMaybeInt(v) },
              { key: "anterior", label: "Anterior", format: (v: any) => fmtMaybeInt(v) },
              { key: "delta", label: "Delta", format: (v: any) => fmtMaybeInt(v) },
              { key: "deltaPct", label: "Delta %", format: (v: any) => fmtMaybePct(v) },
            ]}
          />
        </div>
        <div className="col-span-12 xl:col-span-6">
          <ConfigurableTable
            title="Cambios por cliente"
            subtitle="Actual vs anterior"
            data={cambiosClientes}
            accent="sky"
            storageKey="ceo-comparativo:clientes"
            defaultSortKey="delta"
            columns={[
              { key: "clienteNombre", label: "Cliente" },
              { key: "actual", label: "Actual", format: (v: any) => fmtMaybeInt(v) },
              { key: "anterior", label: "Anterior", format: (v: any) => fmtMaybeInt(v) },
              { key: "delta", label: "Delta", format: (v: any) => fmtMaybeInt(v) },
              { key: "deltaPct", label: "Delta %", format: (v: any) => fmtMaybePct(v) },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
