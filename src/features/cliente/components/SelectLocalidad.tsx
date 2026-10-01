// src/app/Components/cliente/SelectLocalidad.tsx
"use client";

import { useEffect, useState } from "react";
import { getClientCookie, setClientCookie } from "@/lib/cookies";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";

type LocalidadOption = {
  id: number;
  nombre: string;
  estado?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/bff";

export default function SelectLocalidad({ allowCatalog = false }: { allowCatalog?: boolean }) {
  const [phase, setPhase] = useState<"checking" | "missing" | "catalog">("checking");
  const [id, setId] = useState("");
  const [localidades, setLocalidades] = useState<LocalidadOption[]>([]);

  useEffect(() => {
    if (allowCatalog) {
      let active = true;
      fetch(`${API_BASE}/localidades/lite`, { credentials: "include", cache: "no-store" })
        .then((response) => response.ok ? response.json() : [])
        .then((payload) => {
          if (!active) return;
          const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
          const next = rows
            .map((item: Partial<LocalidadOption>) => ({
              id: Number(item.id),
              nombre: String(item.nombre || ""),
              estado: item.estado ?? null,
            }))
            .filter((item: LocalidadOption) => Number.isFinite(item.id) && item.id > 0);
          setLocalidades(next);
          setPhase(next.length ? "catalog" : "missing");
        })
        .catch(() => {
          if (active) setPhase("missing");
        });
      return () => {
        active = false;
      };
    }

    const v = getClientCookie("locId");
    const n = toInt(v);
    if (n) {
      try { localStorage.setItem("locId", String(n)); } catch {}
      const current = new URLSearchParams(location.search).get("loc");
      if (current !== String(n)) {
        location.replace(`/cliente?loc=${n}`);
      } else {
        setPhase("missing"); // no bloquees UI si ya está en la URL
      }
      return;
    }
    setPhase("missing");
  }, [allowCatalog]);

  if (phase === "checking") {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Detectando localidades disponibles...
        </p>
      </div>
    );
  }

  // Fallback manual por si no llegó la cookie
  function apply(idStr: string) {
    const n = toInt(idStr);
    if (!n) return;
    try { localStorage.setItem("locId", String(n)); } catch {}
    setClientCookie("locId", String(n), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    location.assign(isTorreonLocalidadId(n) ? "/cliente/torreon" : `/cliente?loc=${n}`);
  }

  const valid = toInt(id) !== null;

  if (phase === "catalog") {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Localidades disponibles
        </p>
        <div className="grid gap-2">
          {localidades.map((localidad) => (
            <button
              key={localidad.id}
              type="button"
              onClick={() => apply(String(localidad.id))}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
            >
              <span>{localidad.nombre || `Localidad ${localidad.id}`}</span>
              <span className="text-xs font-bold text-slate-400">#{localidad.id}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        No se encontró <code>locId</code> en cookies. Ingresa el ID:
      </p>
      <div className="flex gap-2">
        <div className="fld w-36">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D+/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter" && valid) apply(id); }}
            placeholder=" "
            className={[
              "peer input",
              "dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100",
              !valid && id ? "error" : "",
            ].join(" ")}
            aria-invalid={!valid && !!id}
            aria-describedby="locid-help"
          />
          <label className="lbl">ID (ej. 1)</label>
        </div>
        <button
          type="button"
          onClick={() => apply(id)}
          disabled={!valid}
          className="btn-primary w-auto disabled:opacity-60"
          aria-disabled={!valid}
        >
          Confirmar
        </button>
      </div>
      {!valid && id && (
        <p id="locid-help" className="text-xs text-red-600 dark:text-red-400">
          Ingresa un número válido mayor a 0.
        </p>
      )}
    </div>
  );
}

function toInt(x?: string | null): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}
