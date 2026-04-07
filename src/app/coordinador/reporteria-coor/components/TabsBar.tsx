"use client";

import React from "react";
import type { Tab } from "../lib/types";

export default function TabsBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: Tab; label: string; icon: React.ElementType }>;
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Vistas</div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-[var(--panel-2)] text-[var(--muted)] hover:brightness-95"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
