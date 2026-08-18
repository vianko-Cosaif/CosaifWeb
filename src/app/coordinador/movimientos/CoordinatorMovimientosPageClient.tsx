"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import {
  TorreonOperationTabs,
  type TorreonOperationView,
} from "@/features/torreon/components/TorreonOperationTabs";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { cachedFetchJson } from "@/lib/clientRequestCache";

const TorreonArrastresPanel = dynamic(() => import("../torreon/TorreonArrastresPanel"));
const TorreonNaturalesPanel = dynamic(() => import("../torreon/TorreonNaturalesPanel"));

type LocalidadOption = {
  id: number;
  nombre: string;
};

type Props = {
  apiBase: string;
  empresaIdUsuario: number | null;
  localidadIdUsuario: number | null;
  rol?: "ADMINISTRADOR" | "COORDINADOR";
};

type TorreonMovimientoVista = Exclude<TorreonOperationView, "general">;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";
const ADMIN_LOCALIDAD_KEY = "administrador:movimientosLocalidadId";

function asPositiveId(value?: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchLocalidades(): Promise<LocalidadOption[]> {
  const data = await cachedFetchJson<unknown>(`${API_BASE}/localidades`, {
    cache: "no-store",
    credentials: "include",
  }, { ttlMs: 5 * 60_000 }).catch(() => []);
  const record = data && typeof data === "object" ? data as { data?: unknown } : {};
  const rows = Array.isArray(data) ? data : Array.isArray(record.data) ? record.data : [];
  return rows
    .map((item: Partial<LocalidadOption>) => ({
      id: Number(item.id),
      nombre: String(item.nombre || ""),
    }))
    .filter((item: LocalidadOption) => Number.isFinite(item.id) && item.id > 0);
}

function LocalidadSwitch({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: LocalidadOption[];
  onChange: (value: number | null) => void;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Seguimiento</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Localidad que deseas consultar</h1>
        </div>
        <div className="flex max-w-full flex-wrap gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`inline-flex h-10 min-w-[112px] items-center justify-center rounded-lg px-3 text-sm font-bold transition ${
              value == null
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            }`}
          >
            Todas
          </button>
          {options.map((option) => {
            const active = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                className={`inline-flex h-10 min-w-[112px] items-center justify-center rounded-lg px-3 text-sm font-bold transition ${
                  active
                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                }`}
              >
                {option.nombre || `Localidad ${option.id}`}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function CoordinatorMovimientosPageClient({
  apiBase,
  empresaIdUsuario,
  localidadIdUsuario,
  rol = "COORDINADOR",
}: Props) {
  const isAdmin = rol === "ADMINISTRADOR";
  const assignedLocalidadId = asPositiveId(localidadIdUsuario);
  const [activeLocalidadId, setActiveLocalidadId] = useState<number | null>(
    isAdmin ? null : assignedLocalidadId
  );
  const [localidades, setLocalidades] = useState<LocalidadOption[]>([]);
  const [torreonView, setTorreonView] = useState<TorreonMovimientoVista>("naturales");

  useEffect(() => {
    if (!isAdmin) {
      setActiveLocalidadId(assignedLocalidadId);
      return;
    }
    const persisted = window.localStorage.getItem(ADMIN_LOCALIDAD_KEY);
    setActiveLocalidadId(persisted === "todas" ? null : asPositiveId(persisted));
  }, [assignedLocalidadId, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    fetchLocalidades()
      .then((items) => {
        if (alive) setLocalidades(items);
      })
      .catch(() => {
        if (alive) setLocalidades([]);
      });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    window.localStorage.setItem(
      ADMIN_LOCALIDAD_KEY,
      activeLocalidadId == null ? "todas" : String(activeLocalidadId)
    );
  }, [activeLocalidadId, isAdmin]);

  const selectorOptions = useMemo(() => {
    const seen = new Set<number>();
    return localidades.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [localidades]);

  const activeIsTorreon = Boolean(
    activeLocalidadId && isTorreonLocalidadId(activeLocalidadId)
  );

  if (!isAdmin && !assignedLocalidadId) {
    return (
      <section className="mx-auto w-full max-w-[900px] rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-900">
        Tu usuario no tiene una localidad asignada. Vuelve a iniciar sesión o solicita que se configure tu localidad.
      </section>
    );
  }

  return (
    <section className="min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-4 lg:px-6">
        {isAdmin && (
          <LocalidadSwitch
            value={activeLocalidadId}
            options={selectorOptions}
            onChange={setActiveLocalidadId}
          />
        )}

        {activeIsTorreon && activeLocalidadId ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <TorreonOperationTabs
                value={torreonView}
                includeGeneral={false}
                compact
                onChange={(next) => {
                  if (next !== "general") setTorreonView(next);
                }}
              />
            </div>
            {torreonView === "naturales" ? (
              <TorreonNaturalesPanel
                key={`naturales-${activeLocalidadId}`}
                localidadId={activeLocalidadId}
                apiBase={apiBase}
                rol={rol}
              />
            ) : (
              <TorreonArrastresPanel
                key={`arrastres-${activeLocalidadId}`}
                localidadId={activeLocalidadId}
                variant="movimientos"
                rol={rol}
              />
            )}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-screen-2xl">
            <MovimientosPanel
              key={activeLocalidadId ?? "todas"}
              apiBase={apiBase}
              rol={rol}
              empresaIdUsuario={empresaIdUsuario}
              localidadIdUsuario={activeLocalidadId}
              bloquearLocalidad={!isAdmin}
              puedeCrear
              intervaloAutoMs={15000}
            />
          </div>
        )}
      </div>
    </section>
  );
}
