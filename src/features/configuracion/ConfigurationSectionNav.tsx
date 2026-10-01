"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutGrid, Route, TrainFront } from "lucide-react";

type ConfigurationSection = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
};

const sections: ConfigurationSection[] = [
  { href: "/administrador/configuracion", label: "Resumen", icon: LayoutGrid, exact: true },
  { href: "/administrador/configuracion/empresas", label: "Empresas", icon: Building2 },
  { href: "/administrador/configuracion/naturales", label: "Patios naturales", icon: Route },
  { href: "/administrador/configuracion/arrastre", label: "Arrastre Torreón", icon: TrainFront },
];

export function ConfigurationSectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de configuración" className="overflow-x-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-sm)]">
      <div className="flex min-w-max gap-2">
        {sections.map(({ href, label, icon: Icon, ...item }) => {
          const active = item.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                active
                  ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                  : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
