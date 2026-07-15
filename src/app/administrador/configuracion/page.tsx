import Link from "next/link";
import { ArrowRight, Building2, MapPin, Route, ShieldCheck, TrainFront } from "lucide-react";
import { RealtimeHealthPanel } from "@/features/torreon/components/RealtimeHealthPanel";

export default function ConfiguracionOperativaPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--app-accent)]">Solo administrador</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--app-text)] sm:text-3xl">Centro de configuración</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--app-text-muted)]">Cada catálogo vive en su propia sección. Elige qué deseas administrar sin mezclar empresas, movimientos naturales y Arrastre.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <ConfigurationCard
          href="/administrador/configuracion/empresas"
          icon={Building2}
          eyebrow="Cuentas"
          title="Empresas"
          description="Crea empresas para después asignarlas a usuarios y movimientos."
          details={["Nombre comercial", "Disponible para usuarios", "Sin tocar patios"]}
          tone="slate"
        />
        <ConfigurationCard
          href="/administrador/configuracion/naturales"
          icon={Route}
          eyebrow="Guadalajara y Torreón"
          title="Patios naturales"
          description="Configura localidades, vías, secciones y Torno usados por movimientos naturales."
          details={["Localidades", "Vías naturales", "Secciones y Torno"]}
          tone="emerald"
        />
        <ConfigurationCard
          href="/administrador/configuracion/arrastre"
          icon={TrainFront}
          eyebrow="Exclusivo Torreón"
          title="Patio de Arrastre"
          description="Administra el catálogo independiente para las rutas de vagones de Arrastre."
          details={["Solo Arrastre", "IDs independientes", "No afecta naturales"]}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
          <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[var(--app-accent)]" /><h2 className="text-lg font-black text-[var(--app-text)]">Regla de segmentación</h2></div>
          <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--app-text-muted)]">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"><strong>Natural:</strong> locomotoras y servicios de Guadalajara o Torreón.</p>
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"><strong>Arrastre:</strong> vagones del patio de Arrastre de Torreón.</p>
          </div>
        </section>
        <RealtimeHealthPanel />
      </div>
    </section>
  );
}

type CardTone = "slate" | "emerald" | "blue";

function ConfigurationCard({ href, icon: Icon, eyebrow, title, description, details, tone }: {
  href: string;
  icon: typeof Building2;
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  tone: CardTone;
}) {
  const toneClass = tone === "blue"
    ? "border-blue-200 bg-blue-50/60 text-blue-700 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-300"
    : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300"
      : "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";

  return (
    <Link href={href} className={`group flex min-h-64 flex-col rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-zinc-950/70"><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden="true" />
      </div>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] opacity-75">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 opacity-80">{description}</p>
      <ul className="mt-auto flex flex-wrap gap-2 pt-4" aria-label={`Incluye ${title}`}>
        {details.map((detail) => <li key={detail} className="rounded-full border border-current/15 bg-white/60 px-2.5 py-1 text-[11px] font-black dark:bg-zinc-950/40">{detail}</li>)}
      </ul>
    </Link>
  );
}
