import { CalendarDays, Search } from "lucide-react";
import { STATUS_TABS } from "../constants";
import type { EmpresaOption, FechaCampo, SortDir, SortKey, StatusTab } from "../types";

type Props = {
  status: StatusTab;
  onStatusChange: (status: StatusTab) => void;
  search: string;
  onSearchChange: (search: string) => void;
  empresaId: number | null;
  empresas: EmpresaOption[];
  onEmpresaChange: (empresaId: number | null) => void;
  fechaCampo: FechaCampo;
  onFechaCampoChange: (field: FechaCampo) => void;
  desde: string;
  onDesdeChange: (value: string) => void;
  hasta: string;
  onHastaChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  sortDir: SortDir;
  onSortDirChange: (value: SortDir) => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  onToday: (field: FechaCampo) => void;
  onClearDates: () => void;
};

export function NaturalesFilters({
  status,
  onStatusChange,
  search,
  onSearchChange,
  empresaId,
  empresas,
  onEmpresaChange,
  fechaCampo,
  onFechaCampoChange,
  desde,
  onDesdeChange,
  hasta,
  onHastaChange,
  sortKey,
  onSortKeyChange,
  sortDir,
  onSortDirChange,
  pageSize,
  onPageSizeChange,
  onToday,
  onClearDates,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onStatusChange(tab.value)}
            className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold transition sm:flex-none ${
              status === tab.value
                ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                : "border border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por locomotora, cliente, operador, estado..."
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none shadow-sm focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_160px_1fr_1fr_170px_150px_120px]">
        <SelectControl label="Empresa" value={empresaId ? String(empresaId) : ""} onChange={(value) => onEmpresaChange(value ? Number(value) : null)}>
          <option value="">Todas</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
          ))}
        </SelectControl>
        <SelectControl label="Fecha filtro" value={fechaCampo} onChange={(value) => onFechaCampoChange(value as FechaCampo)}>
          <option value="solicitud">Solicitud</option>
          <option value="inicio">Inicio real</option>
          <option value="fin">Fin real</option>
        </SelectControl>
        <DateControl label="Desde" value={desde} onChange={onDesdeChange} />
        <DateControl label="Hasta" value={hasta} onChange={onHastaChange} />
        <SelectControl label="Orden" value={sortKey} onChange={(value) => onSortKeyChange(value as SortKey)}>
          <option value="cronologia">Cronología operativa</option>
          <option value="inicio">Inicio real</option>
          <option value="fin">Fin real</option>
          <option value="solicitud">Solicitud</option>
          <option value="id">ID</option>
        </SelectControl>
        <SelectControl label="Dirección" value={sortDir} onChange={(value) => onSortDirChange(value as SortDir)}>
          <option value="asc">Ascendente</option>
          <option value="desc">Descendente</option>
        </SelectControl>
        <SelectControl label="Por página" value={String(pageSize)} onChange={(value) => onPageSizeChange(Number(value))}>
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </SelectControl>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <QuickButton onClick={() => onToday("inicio")}>Inicio hoy</QuickButton>
        <QuickButton onClick={() => onToday("fin")}>Cierres hoy</QuickButton>
        <button type="button" onClick={onClearDates} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
          Limpiar fechas
        </button>
      </div>
    </div>
  );
}

function SelectControl({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {children}
      </select>
    </label>
  );
}

function DateControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</span>
      <div className="relative">
        <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
    </label>
  );
}

function QuickButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300">
      {children}
    </button>
  );
}
