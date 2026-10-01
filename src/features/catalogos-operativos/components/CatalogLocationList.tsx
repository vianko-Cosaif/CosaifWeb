"use client";

import { Loader2, MapPin, Route } from "lucide-react";
import type { CatalogLocation } from "../types";

type Props = {
  locations: CatalogLocation[];
  selectedId: number | null;
  query: string;
  loading: boolean;
  onSelect: (location: CatalogLocation) => void;
};

export function CatalogLocationList({ locations, selectedId, query, loading, onSelect }: Props) {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
  const filtered = normalizedQuery
    ? locations.filter((location) => `${location.nombre} ${location.estado}`.toLocaleLowerCase("es-MX").includes(normalizedQuery))
    : locations;

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-slate-500" aria-label="Cargando localidades"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!filtered.length) {
    return <div className="p-8 text-center text-sm font-bold text-slate-500">{query.trim() ? "No hay localidades que coincidan con la búsqueda." : "Sin localidades registradas."}</div>;
  }

  return (
    <div className="max-h-[680px] divide-y divide-slate-100 overflow-auto dark:divide-zinc-900">
      {filtered.map((location) => (
        <button key={location.id} type="button" onClick={() => onSelect(location)} aria-pressed={selectedId === location.id} className={`w-full p-4 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:hover:bg-zinc-900/60 ${selectedId === location.id ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="truncate text-base font-black">{location.nombre}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{location.estado}</p></div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">ID {location.id}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 dark:bg-zinc-900"><Route className="h-3.5 w-3.5" /> {location.totalVias} vías</span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 dark:bg-zinc-900"><MapPin className="h-3.5 w-3.5" /> {location.totalSecciones} secciones</span>
          </div>
        </button>
      ))}
    </div>
  );
}
