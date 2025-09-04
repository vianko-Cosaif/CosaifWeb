"use client";

import Image from "next/image";
import LoginForm from "./LoginForm";
import { Clock3, ActivitySquare, Workflow, ShieldCheck, Cpu } from "lucide-react";

export default function LoginScreen() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-gradient-to-b from-emerald-50 to-sky-50 dark:from-slate-900 dark:to-slate-950">
      {/* Fondo */}
      <div className="hero-beam" />
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]">
        <div className="absolute -top-10 -left-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,#38bdf8_0%,transparent_70%)] blur-2xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,#34d399_0%,transparent_70%)] blur-2xl" />
      </div>

      {/* Safe-area */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-200 via-sky-300 to-sky-200" style={{ paddingTop: "env(safe-area-inset-top)" }} />

      <section className="mx-auto grid w-full max-w-screen-2xl items-center gap-10 px-4 py-10 sm:py-14 lg:grid-cols-2 xl:gap-16">
        {/* Columna info/branding */}
        <div className="order-2 lg:order-1 relative">
          <header className="flex items-center justify-between gap-4">
            <Image
              src="/cosaif-logo.png"
              alt="Cosaif Logistics"
              width={280}
              height={78}
              priority
              sizes="(max-width: 1024px) 60vw, 280px"
              className="h-auto w-[200px] sm:w-[260px] md:w-[280px] motion-safe:transition-transform motion-safe:duration-300 hover:scale-[1.02]"
            />
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-[11px] text-emerald-700 shadow-sm dark:border-emerald-900/50 dark:bg-slate-800/70 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4" /> SSO corporativo
            </span>
          </header>

          {/* Título (sin 3D) */}
          <h1
            className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-600 bg-clip-text text-transparent"
          >
            Operación ferroviaria 
          </h1>

          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Control de movimientos y rondas. Visibilidad clara de punta a punta.
          </p>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Planea y ejecuta todo en un solo lugar.</p>

          {/* Línea / tren */}
          <div className="relative mt-4 h-6 w-full max-w-md">
            <div className="absolute inset-y-0 left-0 right-0 mt-[25px] h-[2px] bg-gradient-to-r from-slate-500 via-sky-300 to-slate-300 dark:from-slate-700 dark:via-sky-600 dark:to-slate-700" />
          </div>

          {/* chips */}
          <ul className="mt-5 flex flex-wrap gap-2">
            {["Movimientos","Rondas","Alertas","Programación"].map((t) => (
              <li key={t} className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition will-change-transform hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                {t}
              </li>
            ))}
          </ul>

          {/* features */}
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            <Feature icon={<Clock3 className="h-5 w-5 text-sky-600" />} title="Alta disponibilidad" text="Operación continua." />
            <Feature icon={<Workflow className="h-5 w-5 text-sky-600" />} title="Flujo operativo" text="Del pedido a la liberación." />
            <li className="sm:col-span-2">
              <div className="pane transition will-change-transform hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <ActivitySquare className="h-5 w-5 text-sky-600" />
                  <div className="flex-1">
                    <p className="font-medium">Trazabilidad total</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Eventos y auditoría por movimiento.</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Bar pct={78} color="bg-sky-500" base="bg-sky-200" />
                      <Bar pct={62} color="bg-emerald-500" base="bg-emerald-200" />
                      <Bar pct={91} color="bg-slate-700" base="bg-slate-300" />
                    </div>
                  </div>
                </div>
              </div>
            </li>
            <Feature icon={<Cpu className="h-5 w-5 text-sky-600" />} title="Optimización" text="Datos para decidir rápido." />
          </ul>
        </div>

        {/* Columna login */}
        <div className="order-1 lg:order-2">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
            <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-700/60 dark:bg-slate-800/60">
              <h2 className="text-center text-lg font-semibold tracking-tight">Iniciar sesión</h2>
              <p className="text-center text-sm text-slate-600 dark:text-slate-300">Credenciales corporativas</p>
            </div>
            <div className="relative p-5 sm:p-7 md:p-8">
              <a href="#form" className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:rounded-md focus:border focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900 dark:focus:bg-slate-800 dark:focus:text-slate-100">
                Saltar al formulario
              </a>
              <div id="form"><LoginForm /></div>
              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Al continuar aceptas los Términos y el Aviso de Privacidad.
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} Cosaif · Todos los derechos reservados.
          </div>
        </div>
      </section>

      <style jsx global>{`
        @media (prefers-reduced-motion: no-preference) {
          .train { animation: trainRun 6s linear infinite; }
          @keyframes trainRun { 0% { transform: translateX(0); } 50% { transform: translateX(calc(100% - 1.75rem)); } 100% { transform: translateX(0); } }
          @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        }
      `}</style>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="reveal" style={{ animationDelay: ".05s" } as React.CSSProperties}>
      <div className="pane transition will-change-transform hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="shrink-0">{icon}</div>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        </div>
      </div>
    </li>
  );
}
function Bar({ pct, color, base }: { pct: number; color: string; base: string }) {
  return (
    <div className={`h-2 rounded ${base}`}>
      <div className={`h-2 rounded ${color} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  );
}
