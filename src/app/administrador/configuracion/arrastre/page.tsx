import { LockKeyhole, ShieldCheck, TrainFront } from "lucide-react";
import { TorreonArrastreYardManager } from "@/features/catalogos-operativos/components/TorreonArrastreYardManager";

export default function ArrastreYardConfigurationPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm dark:border-blue-950 dark:bg-blue-950/20 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><TrainFront className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Torreón · Catálogo independiente</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Patio de Arrastre</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-zinc-400">Crea y modifica únicamente las vías y secciones usadas por vagones de Arrastre. Nada de esta pantalla altera el patio natural de Torreón.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white/70 px-3 py-1.5 text-xs font-black text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><ShieldCheck className="h-3.5 w-3.5" /> Solo administrador</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white/70 px-3 py-1.5 text-xs font-black text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><LockKeyhole className="h-3.5 w-3.5" /> Separado de naturales</span>
        </div>
      </header>
      <TorreonArrastreYardManager />
    </section>
  );
}
