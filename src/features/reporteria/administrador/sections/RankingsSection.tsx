import React from "react";
import type {
  RankingCliente,
  RankingCoordinador,
  RankingEmpresa,
  RankingLocalidad,
  RankingLocomotora,
  RankingOperador,
  RankingSupervisor,
} from "../lib/types";
import { fmtInt, n, fmtMaybePct } from "../lib/utils";
import SectionTitle from "../components/SectionTitle";
import ConfigurableTable from "../components/ConfigurableTable";

export default function RankingsSection({
  rankingOperadores,
  rankingLocomotoras,
  rankingSupervisores,
  rankingCoordinadores,
  rankingEmpresas,
  rankingClientes,
  rankingLocalidades,
}: {
  rankingOperadores: RankingOperador[];
  rankingLocomotoras: RankingLocomotora[];
  rankingSupervisores: RankingSupervisor[];
  rankingCoordinadores: RankingCoordinador[];
  rankingEmpresas: RankingEmpresa[];
  rankingClientes: RankingCliente[];
  rankingLocalidades: RankingLocalidad[];
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Rankings" subtitle="Comparativos por rol, empresa y localidad" />
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Maquinistas"
          subtitle="Ranking por movimientos"
          data={rankingOperadores}
          accent="indigo"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-operadores"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "operadorNombre", label: "Operador" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "conInicioFin", label: "Con fin", format: (v) => fmtInt.format(n(v)) },
            { key: "m0_9", label: "0-9", format: (v) => fmtInt.format(n(v)) },
            { key: "m10_89", label: "10-89", format: (v) => fmtInt.format(n(v)) },
            { key: "gte90", label: "90+", format: (v) => fmtInt.format(n(v)) },
            { key: "lt2", label: "<2", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
            { key: "criticosTotal", label: "Crit", format: (v) => fmtInt.format(n(v)) },
            { key: "criticosPct", label: "% Crit", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Locomotoras"
          subtitle="Ranking por movimientos"
          data={rankingLocomotoras}
          accent="emerald"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-locos"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "locomotiveNumber", label: "Locomotora" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "conInicioFin", label: "Con fin", format: (v) => fmtInt.format(n(v)) },
            { key: "m0_9", label: "0-9", format: (v) => fmtInt.format(n(v)) },
            { key: "m10_89", label: "10-89", format: (v) => fmtInt.format(n(v)) },
            { key: "gte90", label: "90+", format: (v) => fmtInt.format(n(v)) },
            { key: "lt2", label: "<2", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
            { key: "criticosTotal", label: "Crit", format: (v) => fmtInt.format(n(v)) },
            { key: "criticosPct", label: "% Crit", format: (v) => fmtMaybePct(v) },
            { key: "empresas", label: "Empresas", format: (v) => (Array.isArray(v) ? v.join(", ") : "-") },
          ]}
        />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Supervisores"
          subtitle="Movimientos e incidentes"
          data={rankingSupervisores}
          accent="sky"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-supervisores"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "supervisorNombre", label: "Supervisor" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
            { key: "criticosTotal", label: "Crit", format: (v) => fmtInt.format(n(v)) },
            { key: "criticosPct", label: "% Crit", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Coordinadores"
          subtitle="Movimientos e incidentes"
          data={rankingCoordinadores}
          accent="amber"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-coordinadores"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "coordinadorNombre", label: "Coordinador" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
            { key: "criticosTotal", label: "Crit", format: (v) => fmtInt.format(n(v)) },
            { key: "criticosPct", label: "% Crit", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Empresas"
          subtitle="Movimientos e incidentes"
          data={rankingEmpresas}
          accent="indigo"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-empresas"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "empresa", label: "Empresa" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Clientes"
          subtitle="Movimientos e incidentes"
          data={rankingClientes}
          accent="emerald"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-clientes"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "clienteNombre", label: "Cliente" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
        <ConfigurableTable
          title="Localidades"
          subtitle="Movimientos e incidentes"
          data={rankingLocalidades}
          accent="rose"
          highlightKey="totalMovimientos"
          storageKey="reporteria:rank-localidades"
          defaultSortKey="totalMovimientos"
          columns={[
            { key: "localidad", label: "Localidad" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
      </section>
    </div>
  );
}
