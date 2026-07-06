"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ConfigProvider, Empty, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Ronda, RondaInfo } from "../../types";
import { fmtLoco, formatDateTimeMX } from "../../utils";

export type TerminalQueueTableProps = {
  items: Ronda[];
  info: Record<number, RondaInfo>;
  loading: boolean;
  onViewMeasures: (ronda: Ronda) => void;
};

function formatBoardDateTime(iso?: string | null) {
  return formatDateTimeMX(iso, { fallback: "Sin fecha", dateStyle: "short" });
}

function TerminalServiceChip({
  active,
  icon,
  text,
}: {
  active: boolean;
  icon: string;
  text: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${
        active
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {icon} {text}
    </span>
  );
}

export function TerminalQueueTable({
  items,
  info,
  loading,
  onViewMeasures,
}: TerminalQueueTableProps) {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains("dark"));

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const tableTheme = useMemo(
    () => ({
      token: {
        colorPrimary: "#059669",
        borderRadius: 6,
        colorBgContainer: isDarkTheme ? "#0f172a" : "#ffffff",
        colorText: isDarkTheme ? "#e5e7eb" : "#0f172a",
        colorBorder: isDarkTheme ? "#334155" : "#e2e8f0",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      components: {
        Table: {
          headerBg: isDarkTheme ? "#111827" : "#f8fafc",
          headerColor: isDarkTheme ? "#a7f3d0" : "#334155",
          rowHoverBg: isDarkTheme ? "#1e293b" : "#f1f5f9",
          borderColor: isDarkTheme ? "#334155" : "#e2e8f0",
        },
      },
    }),
    [isDarkTheme]
  );

  const columns = useMemo<ColumnsType<Ronda>>(
    () => [
      {
        title: "Turno",
        key: "orden",
        width: 150,
        sorter: (a, b) => a.orden - b.orden,
        render: (_value, _ronda, index) => (
          <div className="font-mono">
            <span
              className={`inline-flex rounded-sm border px-2 py-1 text-xs font-black tracking-widest ${
                index === 0
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 animate-pulse"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-300/60 dark:bg-amber-300/10 dark:text-amber-200"
              }`}
            >
              {index === 0 ? "EN ATENCION" : "EN ESPERA"}
            </span>
            <div className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              POS {index + 1}
            </div>
          </div>
        ),
      },
      {
        title: "Ronda",
        dataIndex: "rondaNumero",
        key: "rondaNumero",
        width: 110,
        sorter: (a, b) => a.rondaNumero - b.rondaNumero,
        render: (value: Ronda["rondaNumero"]) => (
          <span className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-300">
            #{value}
          </span>
        ),
      },
      {
        title: "Locomotora",
        key: "locomotora",
        width: 150,
        render: (_value, ronda) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return (
            <span className="font-mono font-black tracking-wide tabular-nums text-sky-700 dark:text-cyan-200">
              {fmtLoco(mv?.locomotiveNumber ?? mv?.locomotora)}
            </span>
          );
        },
      },
      {
        title: "Empresa",
        key: "empresa",
        width: 210,
        render: (_value, ronda) => (
          <span className="block max-w-[200px] truncate font-mono text-xs font-semibold uppercase text-slate-700 dark:text-slate-200">
            {info[ronda.id]?.empresa?.nombre ?? ronda.empresa?.nombre ?? "—"}
          </span>
        ),
      },
      {
        title: "Origen",
        key: "origen",
        width: 160,
        render: (_value, ronda) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return (
            <span className="font-mono text-xs font-bold uppercase text-emerald-700 dark:text-emerald-200">
              {mv?.viaOrigen?.nombre || "—"}
            </span>
          );
        },
      },
      {
        title: "Destino",
        key: "destino",
        width: 160,
        render: (_value, ronda) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return (
            <span className="font-mono text-xs font-bold uppercase text-sky-700 dark:text-cyan-200">
              {mv?.viaDestino?.nombre || "—"}
            </span>
          );
        },
      },
      {
        title: "Servicios",
        key: "servicios",
        width: 170,
        render: (_value, ronda) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return (
            <div className="flex flex-wrap gap-1 font-mono">
              <TerminalServiceChip active={Boolean(mv?.lavado)} icon="💧" text="Lavado" />
              <TerminalServiceChip active={Boolean(mv?.torno)} icon="⚙️" text="Torno" />
            </div>
          );
        },
      },
      {
        title: "Estado",
        key: "estado",
        width: 140,
        render: (_value, ronda, index) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return (
            <div className="font-mono">
              <span
                className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-black uppercase tracking-wider ${
                  index === 0
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-500 dark:bg-slate-500/10 dark:text-slate-300"
                }`}
              >
                {index === 0 ? "SIGUE" : "COLA"}
              </span>
              <div className="mt-1 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                {mv?.estado || "—"}
              </div>
            </div>
          );
        },
      },
      {
        title: "Creado",
        key: "creado",
        width: 165,
        render: (_value, ronda) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return (
            <span className="font-mono text-xs text-slate-500 dark:text-slate-300">
              {formatBoardDateTime(
                ronda.createdAt ?? mv?.fechaSolicitud ?? mv?.fechaInicio ?? mv?.fechaFin ?? null
              )}
            </span>
          );
        },
      },
      {
        title: "Acción",
        key: "accion",
        width: 110,
        fixed: "right",
        align: "center",
        render: (_value, ronda) => {
          const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
          return Boolean(mv?.torno) ? (
            <Button size="small" onClick={() => onViewMeasures(ronda)} className="font-bold">
              Medidas
            </Button>
          ) : (
            <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">N/A</span>
          );
        },
      },
    ],
    [info, onViewMeasures]
  );

  return (
    <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-none lg:block">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
            Terminal de rondas
          </p>
          <h2 className="font-mono text-lg font-black uppercase text-slate-950 dark:text-slate-100">
            Cola de operacion
          </h2>
        </div>
        <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-200">
          {items.length} pendientes
        </span>
      </div>
      <ConfigProvider theme={tableTheme}>
        <Table<Ronda>
          rowKey="id"
          className="cosaif-terminal-table"
          columns={columns}
          dataSource={items}
          loading={loading ? { spinning: true, tip: "Cargando rondas..." } : false}
          size="middle"
          scroll={{ x: 1420 }}
          rowClassName={(_ronda, index) => (index === 0 ? "terminal-row-current" : "")}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
            position: ["bottomCenter"],
          }}
          expandable={{
            expandedRowRender: (ronda) => {
              const mv = info[ronda.id]?.movimiento ?? ronda.movimiento;
              return (
                <div className="grid gap-3 rounded-sm border border-slate-200 bg-slate-50 p-3 font-mono text-sm dark:border-emerald-400/20 dark:bg-slate-900 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Instrucciones
                    </div>
                    <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                      {mv?.instrucciones?.trim() || "Sin instrucciones."}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Prioridad
                    </div>
                    <p className="mt-1 font-black text-slate-950 dark:text-slate-100">{mv?.prioridad || "—"}</p>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Movimiento
                    </div>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">
                      #{info[ronda.id]?.movimientoId ?? mv?.id ?? ronda.movimientoId ?? "—"}
                    </p>
                  </div>
                </div>
              );
            },
          }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin rondas pendientes" />
            ),
          }}
        />
      </ConfigProvider>
    </div>
  );
}
