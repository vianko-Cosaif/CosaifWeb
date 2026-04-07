"use client";

import React, { useMemo, useState } from "react";
import RankingTable from "./RankingTable";
import { useTableConfig } from "../hooks/useTableConfig";

export default function ConfigurableTable<T extends Record<string, any>>({
  title,
  subtitle,
  data,
  columns,
  accent,
  storageKey,
  defaultSortKey,
  highlightKey,
}: {
  title: string;
  subtitle?: string;
  data: T[];
  columns: Array<{ key: keyof T; label: string; format?: (value: any, row: T) => string }>;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky";
  storageKey: string;
  defaultSortKey: keyof T;
  highlightKey?: keyof T;
}) {
  const [open, setOpen] = useState(false);
  const columnKeys = columns.map((c) => String(c.key));
  const [config, setConfig] = useTableConfig(columnKeys, storageKey, String(defaultSortKey));

  const toggleColumn = (key: string) => {
    if (config.visible.includes(key)) {
      if (config.visible.length === 1) return;
      setConfig({ ...config, visible: config.visible.filter((k) => k !== key) });
      return;
    }
    setConfig({ ...config, visible: [...config.visible, key] });
  };

  const visibleColumns = useMemo(
    () => columns.filter((c) => config.visible.includes(String(c.key))),
    [columns, config.visible]
  );

  const sortedData = useMemo(() => {
    const key = config.sortKey;
    const sorted = [...data].sort((a: any, b: any) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av ?? "").localeCompare(String(bv ?? ""), "es", { numeric: true, sensitivity: "base" });
    });
    if (config.sortDir === "desc") sorted.reverse();
    return config.limit > 0 ? sorted.slice(0, config.limit) : sorted;
  }, [data, config]);

  const controls = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="no-export inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] hover:bg-[var(--panel-2)]"
    >
      Configurar
    </button>
  );

  return (
    <div className="space-y-3">
      {open ? (
        <div className="no-export rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 text-xs shadow-[var(--shadow)]">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Ordenar por</div>
              <select
                value={config.sortKey}
                onChange={(e) => setConfig({ ...config, sortKey: e.target.value })}
                className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--text)]"
              >
                {columns.map((c) => (
                  <option key={String(c.key)} value={String(c.key)}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Orden</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, sortDir: "desc" })}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
                    config.sortDir === "desc"
                      ? "bg-slate-900 text-white"
                      : "bg-[var(--panel-2)] text-[var(--muted)]"
                  }`}
                >
                  Desc
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, sortDir: "asc" })}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
                    config.sortDir === "asc"
                      ? "bg-slate-900 text-white"
                      : "bg-[var(--panel-2)] text-[var(--muted)]"
                  }`}
                >
                  Asc
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Top</div>
              <select
                value={config.limit}
                onChange={(e) => setConfig({ ...config, limit: Number(e.target.value) })}
                className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--text)]"
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={0}>Todos</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Compacto</div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, compact: !config.compact })}
                className={`w-full rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
                  config.compact
                    ? "bg-slate-900 text-white"
                    : "bg-[var(--panel-2)] text-[var(--muted)]"
                }`}
              >
                {config.compact ? "Sí" : "No"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Columnas</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {columns.map((c) => {
                const key = String(c.key);
                const active = config.visible.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleColumn(key)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-[var(--panel-2)] text-[var(--muted)]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <RankingTable
        title={title}
        subtitle={subtitle}
        data={sortedData}
        columns={visibleColumns}
        accent={accent}
        highlightKey={highlightKey}
        controls={controls}
        compact={config.compact}
      />
    </div>
  );
}
