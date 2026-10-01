"use client";

import { useMemo } from "react";
import { DynamicTable, type DynamicTableColumn } from "./index";

type TornoRow = {
  posicion: string;
  alturaCeja: string;
  espesorCeja: string;
  diametroRueda: string;
  estado: "OK" | "ALERTA";
};

const SAMPLE_ROWS: TornoRow[] = [
  { posicion: "L1", alturaCeja: '1 1/4"', espesorCeja: '5/8"', diametroRueda: '36 1/2"', estado: "OK" },
  { posicion: "R1", alturaCeja: '1 1/8"', espesorCeja: '9/16"', diametroRueda: '36 1/4"', estado: "ALERTA" },
  { posicion: "L2", alturaCeja: '1 3/16"', espesorCeja: '5/8"', diametroRueda: '36 3/8"', estado: "OK" },
];

export function DynamicTableWebExample() {
  const columns = useMemo<DynamicTableColumn<TornoRow>[]>(
    () => [
      { key: "posicion", title: "Pos", width: 90, priority: 1 },
      { key: "alturaCeja", title: "Altura ceja", width: 150, priority: 2 },
      { key: "espesorCeja", title: "Espesor ceja", width: 150, priority: 3 },
      { key: "diametroRueda", title: "Diametro rueda", width: 170, priority: 4 },
      {
        key: "estado",
        title: "Estado",
        width: 120,
        priority: 2,
        align: "center",
        render: ({ row }) => (
          <span style={{ color: row.estado === "OK" ? "#0f766e" : "#b45309", fontWeight: 700 }}>{row.estado}</span>
        ),
      },
    ],
    []
  );

  return (
    <DynamicTable
      data={SAMPLE_ROWS}
      columns={columns}
      rowKey={(row) => row.posicion}
      height={360}
      rowHeight={44}
      headerHeight={46}
      maxPriority={4}
      onRowPress={(row) => {
        console.log("Fila seleccionada:", row.posicion);
      }}
    />
  );
}
