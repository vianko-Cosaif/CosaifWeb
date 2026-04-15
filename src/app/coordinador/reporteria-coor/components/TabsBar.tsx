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
    <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Vistas</p>
        <div className="flex max-w-full flex-1 justify-end overflow-x-auto">
          <div className="flex gap-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange(t.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
    </div>
  );
}
