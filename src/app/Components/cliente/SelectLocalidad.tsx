// src/app/Components/cliente/SelectLocalidad.tsx
"use client";

import { useEffect, useState } from "react";
import { getClientCookie, setClientCookie } from "@/lib/cookies";

export default function SelectLocalidad() {
  const [phase, setPhase] = useState<"checking" | "missing">("checking");
  const [id, setId] = useState("");

  useEffect(() => {
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
  }, []);

  if (phase === "checking") {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Detectando localidad desde la cookie…
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
    location.assign(`/cliente?loc=${n}`);
  }

  const valid = toInt(id) !== null;

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
