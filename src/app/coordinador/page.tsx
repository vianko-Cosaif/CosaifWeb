"use client";

import React, { useEffect, useState } from "react";
import RailQueueBoard from "./RailQueueBoard";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import { getClientCookie, setClientCookie } from "@/lib/cookies";
import { syncFirebaseNotificationLocalidad } from "@/lib/firebase";
import { getPrimaryTorreonLocalidadId, isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import CoordinatorTorreonDashboard from "./torreon/CoordinatorTorreonDashboard";

type LocalidadOption = {
  id: number;
  nombre: string;
  estado?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";
const DEFAULT_GDL_LOCALIDAD_ID = Number(process.env.NEXT_PUBLIC_GDL_LOCALIDAD_ID || 1);
const RONDAS_LOCALIDAD_KEY = "coordinador:rondasLocalidadId";

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

function RondasLocalidadSelector({
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
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Rondas</p>
          <h1 className="text-lg font-bold text-slate-950 dark:text-white">Localidad operativa</h1>
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

const CoordinadorPage: React.FC = () => {
  const [assignedLocalidadId, setAssignedLocalidadId] = useState<number | null>(null);
  const [activeLocalidadId, setActiveLocalidadId] = useState<number | null>(null);
  const [localidades, setLocalidades] = useState<LocalidadOption[]>([]);

  useEffect(() => {
    const raw =
      getClientCookie("locId") ??
      (typeof window !== "undefined" ? localStorage.getItem("locId") : null);

    let num = raw ? Number(raw) : NaN;

    // si no hay locId válido, usamos 1 y lo dejamos grabado
    if (!Number.isFinite(num) || num <= 0) {
      num = 1;
      try {
        localStorage.setItem("locId", "1");
      } catch { }
      setClientCookie("locId", "1", {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    setAssignedLocalidadId(num);

    const persisted = asPositiveId(
      typeof window !== "undefined" ? window.localStorage.getItem(RONDAS_LOCALIDAD_KEY) : null
    );
    setActiveLocalidadId(persisted ?? num);
  }, []);

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
          assignedLocalidad || { id: assignedLocalidadId ?? DEFAULT_GDL_LOCALIDAD_ID, nombre: "Guadalajara" },
          localidades.find((localidad) => isTorreonLocalidadId(localidad.id)) || {
            id: torreonLocalidadId,
            nombre: "Torreon",
          },
        ]
      : [
          assignedLocalidad || {
            id: assignedLocalidadId ?? DEFAULT_GDL_LOCALIDAD_ID,
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
      window.localStorage.setItem(RONDAS_LOCALIDAD_KEY, String(activeLocalidadId));
    } catch {}

    window.dispatchEvent(new CustomEvent("cosaif:localidad-change", { detail: { localidadId: activeLocalidadId } }));
    void syncFirebaseNotificationLocalidad(activeLocalidadId).catch((error) => {
      console.warn("No se pudo sincronizar localidad FCM.", error);
    });
  }, [activeLocalidadId]);

  const activeIsTorreon = Boolean(activeLocalidadId && isTorreonLocalidadId(activeLocalidadId));

  return (
    <section className="w-full min-w-0">
      {activeLocalidadId ? (
        <div className="mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-8 min-w-0">
          <DynamicBanner />
          <RondasLocalidadSelector
            value={activeLocalidadId}
            options={selectorOptions}
            onChange={setActiveLocalidadId}
          />
          {activeIsTorreon ? (
            <CoordinatorTorreonDashboard key={activeLocalidadId} localidadId={activeLocalidadId} showBanner={false} />
          ) : (
            <RailQueueBoard key={activeLocalidadId} localidadId={activeLocalidadId} />
          )}
        </div>
      ) : null}
    </section>
  );
};

export default CoordinadorPage;
