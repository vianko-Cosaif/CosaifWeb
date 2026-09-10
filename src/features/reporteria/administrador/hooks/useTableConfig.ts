"use client";

import { useEffect, useState } from "react";

export type TableConfig = {
  visible: string[];
  sortKey: string;
  sortDir: "asc" | "desc";
  limit: number;
  compact: boolean;
};

export function useTableConfig(
  keys: string[],
  storageKey: string,
  defaultSortKey: string
): [TableConfig, (next: TableConfig) => void] {
  const defaults: TableConfig = {
    visible: keys,
    sortKey: defaultSortKey || keys[0] || "",
    sortDir: "desc",
    limit: 10,
    compact: false,
  };

  const [config, setConfig] = useState<TableConfig>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<TableConfig>;
      const visible = (parsed.visible ?? defaults.visible).filter((k) => keys.includes(k));
      return {
        ...defaults,
        ...parsed,
        visible: visible.length ? visible : defaults.visible,
        sortKey: keys.includes(parsed.sortKey ?? "") ? (parsed.sortKey as string) : defaults.sortKey,
      };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch {}
  }, [config, storageKey]);

  return [config, setConfig];
}
