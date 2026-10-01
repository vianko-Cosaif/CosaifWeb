"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Building2, CheckCircle2, Loader2, Plus, RefreshCw } from "lucide-react";
import { createCompany, fetchCompanies } from "../api";
import type { CatalogCompany } from "../types";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";

function companyKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");
}

function sortCompanies(companies: CatalogCompany[]) {
  return [...companies].sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX", { sensitivity: "base" }));
}

export function CatalogCompanyManager() {
  const [companies, setCompanies] = useState<CatalogCompany[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const normalizedNames = useMemo(
    () => new Set(companies.map((company) => companyKey(company.nombre))),
    [companies],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCompanies(await fetchCompanies());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");

    if (cleanName.length < 2) {
      setError("Escribe un nombre de empresa de al menos 2 caracteres.");
      return;
    }
    if (cleanName.length > 100) {
      setError("El nombre de la empresa no puede superar 100 caracteres.");
      return;
    }
    if (normalizedNames.has(companyKey(cleanName))) {
      setError(`La empresa “${cleanName}” ya está registrada.`);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createCompany(cleanName);
      const refreshed = await fetchCompanies().catch(() => null);
      if (refreshed) {
        setCompanies(refreshed);
      } else if (Number(created?.id) > 0) {
        setCompanies((current) => sortCompanies([...current, { id: Number(created.id), nombre: cleanName }]));
      }
      setName("");
      setNotice(`Empresa “${cleanName}” creada correctamente. Ya puede asignarse a nuevos usuarios y movimientos.`);
      window.dispatchEvent(new CustomEvent("cosaif:companies-updated", { detail: { company: created } }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear la empresa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="companies-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="companies-title" className="text-lg font-black">Registro de empresas</h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-500">
              Registra una empresa antes de crear sus usuarios o movimientos.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`${buttonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`}
          onClick={() => void load()}
          disabled={loading || saving}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
        <form onSubmit={submit} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <label htmlFor="new-company-name" className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-300">
            Nueva empresa
          </label>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-zinc-400">Usa el nombre comercial que verá el personal.</p>
          <input
            id="new-company-name"
            className={`${inputClass} mt-3`}
            value={name}
            onChange={(event) => { setName(event.target.value); setError(null); setNotice(null); }}
            placeholder="Ej. Ferrocarril del Norte"
            autoComplete="organization"
            maxLength={100}
            disabled={saving}
          />
          <button
            type="submit"
            className={`${buttonClass} mt-3 w-full border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
            disabled={saving || !name.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Creando empresa…" : "Crear empresa"}
          </button>
        </form>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-700 dark:text-zinc-200">Empresas registradas</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
              {companies.length}
            </span>
          </div>

          <div aria-live="polite" className="mt-3 space-y-2">
            {error ? <CompanyMessage tone="error" text={error} /> : null}
            {notice ? <CompanyMessage tone="success" text={notice} /> : null}
          </div>

          {loading && !companies.length ? (
            <div className="mt-3 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando empresas…
            </div>
          ) : companies.length ? (
            <ul className="mt-3 grid max-h-56 gap-2 overflow-auto pr-1 sm:grid-cols-2" aria-label="Lista de empresas registradas">
              {companies.map((company) => (
                <li key={company.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <Building2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="truncate text-sm font-bold" title={company.nombre}>{company.nombre}</span>
                </li>
              ))}
            </ul>
          ) : !error ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-bold text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
              Aún no hay empresas registradas.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CompanyMessage({ tone, text }: { tone: "error" | "success"; text: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  const classes = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
    : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200";
  return <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-bold ${classes}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" />{text}</div>;
}
