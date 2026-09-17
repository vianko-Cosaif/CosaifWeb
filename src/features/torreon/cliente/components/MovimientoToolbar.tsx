"use client";
import { RefreshCw, X, Info } from "lucide-react";
import type { Ambito } from "../types";
import s from "../../presentation/rail.module.scss";
type Props = {
  ambito: Ambito;
  search: string;
  dateFilter: string;
  refreshing: boolean;
  actuales?: number;
  pasados?: number;
  onAmbito: (ambito: Ambito) => void;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
  onNuevo: () => void;
};

export function MovimientoToolbar({
  ambito,
  search,
  dateFilter,
  refreshing,
  actuales,
  pasados,
  onAmbito,
  onSearch,
  onDateFilter,
  onRefresh,
}: Props) {
  return (
    <section aria-label="Filtros de arrastres" className={s.filterBar}>
      <div className={s.filterTop}>
        <div className={s.tabs} role="group" aria-label="Periodo de arrastres">
          <button
            type="button"
            aria-pressed={ambito === "actuales"}
            onClick={() => onAmbito("actuales")}
          >
            Actuales{actuales !== undefined ? <span>{actuales}</span> : null}
          </button>
          <button
            type="button"
            aria-pressed={ambito === "pasados"}
            onClick={() => onAmbito("pasados")}
          >
            Pasados{pasados !== undefined ? <span>{pasados}</span> : null}
          </button>
        </div>
        <button type="button" className={s.button} onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={15} aria-hidden />
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>
      <div className={s.filterFields}>
        <label className={s.field}>
          Buscar arrastres
          <input
            type="search"
            aria-label="Buscar por folio, vagón, estado o vía"
            placeholder="Folio, vagón, estado o vía…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <label className={s.field}>
          Fecha de solicitud
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => onDateFilter(event.target.value)}
          />
        </label>
        {search || dateFilter ? (
          <button
            type="button"
            className={s.button}
            onClick={() => {
              onSearch("");
              onDateFilter("");
            }}
          >
            <X size={15} aria-hidden />
            Limpiar filtros
          </button>
        ) : null}
      </div>
      <p className={s.scopeNote}>
        <Info size={14} aria-hidden />
        {ambito === "actuales"
          ? "Todas las empresas de tu localidad. Puedes gestionar únicamente las solicitudes de tu empresa."
          : "Historial de tu empresa en esta localidad. Incluye solicitudes concluidas y canceladas."}
      </p>
    </section>
  );
}
