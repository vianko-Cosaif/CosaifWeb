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
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Vistas</p>
        <div className="flex min-w-0 max-w-full flex-wrap">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(t.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition ${
                    active
                      ? "bg-[var(--app-text)] text-[var(--app-surface)]"
                      : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-subtle)]"
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
