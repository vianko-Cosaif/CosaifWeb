"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Boxes, TrainFront, type LucideIcon } from "lucide-react";
import MovimientosPanel from "@/app/Components/movimientos/MovimientosPanel";
import { getPrimaryTorreonLocalidadId, isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import TorreonArrastresPanel from "../torreon/TorreonArrastresPanel";
import TorreonNaturalesPanel from "../torreon/TorreonNaturalesPanel";

type LocalidadOption = {
  id: number;
  nombre: string;
  estado?: string | null;
};

type Props = {
  apiBase: string;
  token: string;
  empresaIdUsuario: number | null;
  localidadIdUsuario: number | null;
};

type TorreonMovimientoVista = "naturales" | "arrastres";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";
const DEFAULT_GDL_LOCALIDAD_ID = Number(process.env.NEXT_PUBLIC_GDL_LOCALIDAD_ID || 1);
const COORDINADOR_LOCALIDAD_KEY = "coordinador:rondasLocalidadId";

const TORREON_MOVIMIENTO_VIEWS: Array<{
  value: TorreonMovimientoVista;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "naturales",
    label: "Naturales",
    description: "Movimientos ferroviarios del patio",
    icon: TrainFront,
  },
  {
    value: "arrastres",
    label: "Arrastres",
    description: "Solicitudes con vagones y zonas",
    icon: Boxes,
  },
];

function asPositiveId(value?: string | number | null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isGdlLocalidadName(value?: string | null) {
  const name = String(value || "").trim().toUpperCase();
  return name === "GDL" || name.includes("GUADALAJARA");
}

function uniqueLocalidades(items: LocalidadOption[]) {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (!Number.isFinite(item.id) || item.id <= 0 || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function fetchLocalidades(): Promise<LocalidadOption[]> {
  const response = await fetch(`${API_BASE}/localidades`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return (Array.isArray(data) ? data : data?.data || [])
    .map((item: Partial<LocalidadOption>) => ({
      id: Number(item.id),
      nombre: String(item.nombre || ""),
      estado: item.estado ?? null,
    }))
    .filter((item: LocalidadOption) => Number.isFinite(item.id) && item.id > 0);
}

function LocalidadSwitch({
  value,
  options,
  onChange,
}: {
  value: number;
  options: LocalidadOption[];
  onChange: (value: number) => void;
}) {
  if (options.length <= 1) return null;

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Operacion</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Entidad operativa</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {options.map((option) => {
            const active = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                className={`inline-flex h-10 min-w-[128px] items-center justify-center rounded-lg px-3 text-sm font-bold transition ${
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

function TorreonMovimientoLayout({
  value,
  onChange,
  children,
}: {
  value: TorreonMovimientoVista;
  onChange: (value: TorreonMovimientoVista) => void;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Torreón</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Movimientos del patio</h1>
          </div>
          <div className="grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
            {TORREON_MOVIMIENTO_VIEWS.map((option) => {
              const Icon = option.icon;
              const active = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  className={`flex min-h-[58px] items-center gap-3 rounded-lg px-4 text-left transition ${
                    active
                      ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                      : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-white/10 text-emerald-200 dark:bg-slate-950/10 dark:text-emerald-700" : "bg-white text-slate-400 dark:bg-slate-900 dark:text-slate-500"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className={`mt-0.5 block text-[11px] font-semibold ${
                      active ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-500"
                    }`}>
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4 lg:p-5">
        {children}
      </div>
    </section>
  );
}

export default function CoordinatorMovimientosPageClient({
  apiBase,
  token,
  empresaIdUsuario,
  localidadIdUsuario,
}: Props) {
  const assignedLocalidadId = asPositiveId(localidadIdUsuario) ?? DEFAULT_GDL_LOCALIDAD_ID;
  const [activeLocalidadId, setActiveLocalidadId] = useState<number>(() => assignedLocalidadId);
  const [localidades, setLocalidades] = useState<LocalidadOption[]>([]);
  const [torreonView, setTorreonView] = useState<TorreonMovimientoVista>("naturales");

  useEffect(() => {
    const persisted = asPositiveId(window.localStorage.getItem(COORDINADOR_LOCALIDAD_KEY));
    setActiveLocalidadId(persisted ?? assignedLocalidadId);
  }, [assignedLocalidadId]);

  useEffect(() => {
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
  }, []);

  const assignedLocalidad = localidades.find((localidad) => localidad.id === assignedLocalidadId) || null;
  const assignedIsTorreon = isTorreonLocalidadId(assignedLocalidadId);
  const assignedIsGdl = Boolean(
    assignedLocalidadId &&
      (
        isGdlLocalidadName(assignedLocalidad?.nombre) ||
        (!assignedLocalidad && assignedLocalidadId === DEFAULT_GDL_LOCALIDAD_ID)
      )
  );
  const torreonLocalidadId = getPrimaryTorreonLocalidadId();
  const selectorOptions = uniqueLocalidades(
    assignedIsGdl
      ? [
          assignedLocalidad || { id: assignedLocalidadId, nombre: "Guadalajara" },
          localidades.find((localidad) => isTorreonLocalidadId(localidad.id)) || {
            id: torreonLocalidadId,
            nombre: "Torreon",
          },
        ]
      : [
          assignedLocalidad || {
            id: assignedLocalidadId,
            nombre: assignedIsTorreon ? "Torreon" : "Guadalajara",
          },
        ]
  );

  useEffect(() => {
    if (!activeLocalidadId || selectorOptions.length === 0) return;
    if (selectorOptions.some((option) => option.id === activeLocalidadId)) return;
    setActiveLocalidadId(selectorOptions[0].id);
  }, [activeLocalidadId, selectorOptions]);

  useEffect(() => {
    if (!activeLocalidadId) return;
    try {
      window.localStorage.setItem(COORDINADOR_LOCALIDAD_KEY, String(activeLocalidadId));
    } catch {}
  }, [activeLocalidadId]);

  const activeIsTorreon = isTorreonLocalidadId(activeLocalidadId);

  return (
    <section className="w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-4 lg:px-6">
        <LocalidadSwitch
          value={activeLocalidadId}
          options={selectorOptions}
          onChange={setActiveLocalidadId}
        />

        {activeIsTorreon ? (
          <TorreonMovimientoLayout value={torreonView} onChange={setTorreonView}>
            {torreonView === "naturales" ? (
              <TorreonNaturalesPanel
                key={`naturales-${activeLocalidadId}`}
                localidadId={activeLocalidadId}
                apiBase={apiBase}
              />
            ) : (
              <TorreonArrastresPanel
                key={`arrastres-${activeLocalidadId}`}
                localidadId={activeLocalidadId}
                variant="movimientos"
              />
            )}
          </TorreonMovimientoLayout>
        ) : (
          <div className="mx-auto w-full max-w-screen-2xl">
            <MovimientosPanel
              key={activeLocalidadId}
              apiBase={apiBase}
              rol="COORDINADOR"
              token={token}
              empresaIdUsuario={empresaIdUsuario}
              localidadIdUsuario={activeLocalidadId}
              bloquearLocalidad={false}
              puedeCrear
              intervaloAutoMs={15000}
            />
          </div>
        )}
      </div>
    </section>
  );
}
