"use client";

import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Calendar,
  CalendarRange,
  CalendarClock,
  FileDown,
  ChevronDown,
} from "lucide-react";

/**
 * ✅ Next.js App Router:
 * page.tsx NO puede exportar por default un componente con props custom.
 * Por eso exportamos Page() y adentro montamos ReporteriaClient.
 */
export default function Page() {
  // Si luego quieres meter ids reales, aquí los sacas de donde sea (cookies, store, etc.)
  return (
    <div className="w-full">
      <ReporteriaClient apiBase="/bff" empresaIdUsuario={null} localidadIdUsuario={null} />
    </div>
  );
}

type PeriodoUI = "dia" | "semana" | "mes" | "bimestre" | "semestre" | "anual";
type PeriodoBack = "DIA" | "SEMANA" | "MES" | "BIMESTRE" | "SEMESTRE" | "ANUAL";

type Card = {
  id: PeriodoUI;
  title: string;
  desc: string;
  icon: LucideIcon;
  backPeriodo: PeriodoBack;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function clampInt(v: unknown, min: number, max: number) {
  const x = Number.parseInt(String(v), 10);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function isYYYYMM(s: string) {
  return /^\d{4}-\d{2}$/.test(s);
}
function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function buildAnchorFecha(params: {
  periodo: PeriodoUI;
  diaISO: string;
  semanaISO: string; // YYYY-MM-DD (ancla, cualquier día de la semana)
  mesYM: string; // YYYY-MM
  bimYear: number;
  bimIndex: number; // 1..6
  semYear: number;
  semIndex: number; // 1..2
  anio: number;
}) {
  const { periodo } = params;

  if (periodo === "dia") return params.diaISO;

  // SEMANA: backend arma el rango con esta fecha ancla
  if (periodo === "semana") return params.semanaISO;

  if (periodo === "mes") return `${params.mesYM}-01`;

  if (periodo === "bimestre") {
    const year = params.bimYear;
    const b = params.bimIndex; // 1..6
    const startMonth = (b - 1) * 2 + 1; // 1,3,5,7,9,11
    return `${year}-${pad2(startMonth)}-01`;
  }

  if (periodo === "semestre") {
    const year = params.semYear;
    const s = params.semIndex; // 1..2
    const startMonth = s === 1 ? 1 : 7;
    return `${year}-${pad2(startMonth)}-01`;
  }

  return `${params.anio}-01-01`;
}

function buildFileName(periodo: PeriodoBack, fecha: string) {
  return `reporteria_${periodo}_${fecha}.pdf`;
}

function parseContentDispositionFilename(cd: string | null) {
  if (!cd) return null;

  // filename*=UTF-8''...
  const star = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/["']/g, ""));
    } catch {
      return star[1].replace(/["']/g, "");
    }
  }

  // filename="..."
  const plain = cd.match(/filename\s*=\s*"?([^"]+)"?/i);
  if (plain?.[1]) return plain[1];

  return null;
}

async function fetchPdf(url: string) {
  const r = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    mode: "same-origin",
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(
      `${r.status} ${r.statusText}${txt ? ` :: ${txt.slice(0, 240)}` : ""}`
    );
  }

  const blob = await r.blob();
  const cd = r.headers.get("content-disposition");
  const fileName = parseContentDispositionFilename(cd);

  return { blob, fileName };
}

function withQs(url: string, qs: URLSearchParams) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${qs.toString()}`;
}

function ReporteriaClient({
  apiBase = "/bff",
  empresaIdUsuario = null,
  localidadIdUsuario = null,
}: {
  apiBase?: string;
  empresaIdUsuario?: number | null;
  localidadIdUsuario?: number | null;
}) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const currentBim = Math.floor((thisMonth - 1) / 2) + 1; // 1..6
  const currentSem = thisMonth <= 6 ? 1 : 2;

  const cards = useMemo<Card[]>(
    () => [
      {
        id: "dia",
        title: "Día",
        desc: "Selecciona una fecha (YYYY-MM-DD).",
        icon: CalendarDays,
        backPeriodo: "DIA",
      },
      {
        id: "semana",
        title: "Semana",
        desc: "Selecciona una fecha dentro de la semana (YYYY-MM-DD).",
        icon: CalendarRange,
        backPeriodo: "SEMANA",
      },
      {
        id: "mes",
        title: "Mes",
        desc: "Selecciona un mes (YYYY-MM).",
        icon: Calendar,
        backPeriodo: "MES",
      },
      {
        id: "bimestre",
        title: "Bimestre",
        desc: "Selecciona año + bimestre (1–6).",
        icon: CalendarClock,
        backPeriodo: "BIMESTRE",
      },
      {
        id: "semestre",
        title: "Semestre",
        desc: "Selecciona año + semestre (1–2).",
        icon: CalendarClock,
        backPeriodo: "SEMESTRE",
      },
      {
        id: "anual",
        title: "Año",
        desc: "Selecciona solo el año.",
        icon: FileDown,
        backPeriodo: "ANUAL",
      },
    ],
    []
  );

  const [open, setOpen] = useState<PeriodoUI>("dia");

  // Inputs
  const [diaISO, setDiaISO] = useState<string>(todayISO());
  const [semanaISO, setSemanaISO] = useState<string>(todayISO());
  const [mesYM, setMesYM] = useState<string>(`${thisYear}-${pad2(thisMonth)}`);

  const [bimYear, setBimYear] = useState<number>(thisYear);
  const [bimIndex, setBimIndex] = useState<number>(currentBim);

  const [semYear, setSemYear] = useState<number>(thisYear);
  const [semIndex, setSemIndex] = useState<number>(currentSem);

  const [anio, setAnio] = useState<number>(thisYear);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const activeCard = cards.find((c) => c.id === open)!;

  const anchorFecha = useMemo(() => {
    return buildAnchorFecha({
      periodo: open,
      diaISO,
      semanaISO,
      mesYM,
      bimYear,
      bimIndex,
      semYear,
      semIndex,
      anio,
    });
  }, [open, diaISO, semanaISO, mesYM, bimYear, bimIndex, semYear, semIndex, anio]);

  function validate(): { periodo: PeriodoBack; fecha: string } {
    setError(null);
    setOkMsg(null);

    if (open === "dia") {
      if (!diaISO || !isYYYYMMDD(diaISO)) throw new Error("Fecha inválida para Día.");
    }

    if (open === "semana") {
      if (!semanaISO || !isYYYYMMDD(semanaISO)) throw new Error("Fecha inválida para Semana.");
    }

    if (open === "mes") {
      if (!mesYM || !isYYYYMM(mesYM)) throw new Error("Mes inválido.");
    }

    if (open === "bimestre") {
      const y = clampInt(bimYear, 2000, 2100);
      const b = clampInt(bimIndex, 1, 6);
      if (y !== bimYear) setBimYear(y);
      if (b !== bimIndex) setBimIndex(b);
    }

    if (open === "semestre") {
      const y = clampInt(semYear, 2000, 2100);
      const s = clampInt(semIndex, 1, 2);
      if (y !== semYear) setSemYear(y);
      if (s !== semIndex) setSemIndex(s);
    }

    if (open === "anual") {
      const y = clampInt(anio, 2000, 2100);
      if (y !== anio) setAnio(y);
    }

    return { periodo: activeCard.backPeriodo, fecha: anchorFecha };
  }

  async function onGenerate() {
    if (busy) return;

    try {
      setBusy(true);
      const { periodo, fecha } = validate();

      const qs = new URLSearchParams({ periodo, fecha });

      if (empresaIdUsuario != null && Number.isFinite(empresaIdUsuario)) {
        qs.set("empresaId", String(empresaIdUsuario));
      }
      if (localidadIdUsuario != null && Number.isFinite(localidadIdUsuario)) {
        qs.set("localidadId", String(localidadIdUsuario));
      }

      // Front “inteligente”: prueba rutas típicas (porque ya te pegó 404).
      const candidates = [
        `${apiBase}/reporteria/movimientos/pdf`,
        `${apiBase}/reporteria/pdf`,
        `${apiBase}/reporteria/movimientos`, // por si lo montaron distinto
      ].map((u) => withQs(u, qs));

      let lastErr: any = null;

      for (const url of candidates) {
        try {
          const { blob, fileName } = await fetchPdf(url);

          const finalName = fileName || buildFileName(periodo, fecha);
          const href = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = href;
          a.download = finalName;
          document.body.appendChild(a);
          a.click();
          a.remove();

          URL.revokeObjectURL(href);

          setOkMsg(`PDF generado: ${finalName}`);
          return;
        } catch (e: any) {
          lastErr = e;
        }
      }

      throw lastErr || new Error("No se pudo generar el PDF.");
    } catch (e: any) {
      setError(e?.message || "Error al generar PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <BarChart3 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Reportería
        </h1>
      </div>

      {(error || okMsg) && (
        <div
          className={`mb-4 rounded-2xl border p-4 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200"
          }`}
        >
          {error || okMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          const isOpen = open === c.id;

          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <button
                type="button"
                onClick={() => setOpen(c.id)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                      {c.title}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {c.desc}
                  </p>
                </div>

                <ChevronDown
                  className={`mt-2 h-5 w-5 text-slate-400 transition-transform dark:text-slate-500 ${
                    isOpen ? "" : "-rotate-90"
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-slate-200 p-5 dark:border-slate-800">
                  {c.id === "dia" && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={diaISO}
                        onChange={(e) => setDiaISO(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  )}

                  {c.id === "semana" && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Fecha (ancla de semana)
                      </label>
                      <input
                        type="date"
                        value={semanaISO}
                        onChange={(e) => setSemanaISO(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        El backend toma esa fecha y arma el rango semanal.
                      </div>
                    </div>
                  )}

                  {c.id === "mes" && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Mes
                      </label>
                      <input
                        type="month"
                        value={mesYM}
                        onChange={(e) => setMesYM(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  )}

                  {c.id === "bimestre" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          Año
                        </label>
                        <input
                          type="number"
                          min={2000}
                          max={2100}
                          value={bimYear}
                          onChange={(e) => setBimYear(clampInt(e.target.value, 2000, 2100))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          Bimestre
                        </label>
                        <select
                          value={bimIndex}
                          onChange={(e) => setBimIndex(clampInt(e.target.value, 1, 6))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value={1}>B01 (Ene–Feb)</option>
                          <option value={2}>B02 (Mar–Abr)</option>
                          <option value={3}>B03 (May–Jun)</option>
                          <option value={4}>B04 (Jul–Ago)</option>
                          <option value={5}>B05 (Sep–Oct)</option>
                          <option value={6}>B06 (Nov–Dic)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {c.id === "semestre" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          Año
                        </label>
                        <input
                          type="number"
                          min={2000}
                          max={2100}
                          value={semYear}
                          onChange={(e) => setSemYear(clampInt(e.target.value, 2000, 2100))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          Semestre
                        </label>
                        <select
                          value={semIndex}
                          onChange={(e) => setSemIndex(clampInt(e.target.value, 1, 2))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value={1}>S1 (Ene–Jun)</option>
                          <option value={2}>S2 (Jul–Dic)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {c.id === "anual" && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Año
                      </label>
                      <input
                        type="number"
                        min={2000}
                        max={2100}
                        value={anio}
                        onChange={(e) => setAnio(clampInt(e.target.value, 2000, 2100))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={onGenerate}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900"
                      aria-busy={busy}
                    >
                      <FileDown className="h-4 w-4" />
                      {busy ? "Generando…" : "Generar PDF"}
                    </button>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                    Backend recibe:{" "}
                    <span className="font-mono text-slate-800 dark:text-slate-100">
                      {`periodo=${activeCard.backPeriodo}&fecha=${anchorFecha}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
