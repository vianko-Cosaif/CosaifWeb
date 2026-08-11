import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PanelGrafico from "@/app/Components/PanelGrafico/PanelGrafico";
import { PANEL_GRAFICO_ENABLED } from "@/app/Components/PanelGrafico/panelGrafico.config";

export const dynamic = "force-dynamic";

type SP = { localidadId?: string | string[]; empresaId?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  if (!PANEL_GRAFICO_ENABLED) redirect("/cliente");

  const c = await cookies();
  const token = c.get("token")?.value;
  if (!token) redirect("/login?loc=cliente");

  const params = await searchParams;
  return (
    <PanelGrafico
      backHref="/cliente"
      backLabel="Operacion"
      localidadId={toInt(first(params.localidadId)) ?? toInt(c.get("locId")?.value)}
      empresaId={toInt(first(params.empresaId)) ?? toInt(c.get("empresaId")?.value)}
    />
  );
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toInt(value?: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
