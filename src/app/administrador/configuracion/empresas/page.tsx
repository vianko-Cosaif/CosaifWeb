import { Building2 } from "lucide-react";
import { CatalogCompanyManager } from "@/features/catalogos-operativos/components/CatalogCompanyManager";

export default function EmpresasConfigurationPage() {
  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Cuentas operativas"
        title="Empresas"
        description="Crea empresas para asignarlas posteriormente a usuarios y movimientos. Esta sección no modifica localidades ni vías."
      />
      <CatalogCompanyManager />
    </section>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-200"><Building2 className="h-6 w-6" /></span>
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-zinc-400">{description}</p></div>
      </div>
    </header>
  );
}
