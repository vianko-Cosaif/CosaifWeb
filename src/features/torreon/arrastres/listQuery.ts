import type { Arrastre } from "./types";
import type { TorreonPage } from "../useTorreonCollection";
import { movementDateBoundary } from "@/lib/dateBoundary";

export function parseArrastrePage(value: unknown): TorreonPage<Arrastre> {
  if (!value || typeof value !== "object" || !("data" in value) || !("meta" in value))
    throw new Error("Actualiza el servicio de Torreón para consultar la lista paginada.");
  const page = value as TorreonPage<Arrastre>;
  if (
    !Array.isArray(page.data) ||
    !page.meta ||
    !Number.isSafeInteger(page.meta.total) ||
    page.meta.total < 0 ||
    !Number.isSafeInteger(page.meta.page) ||
    page.meta.page < 1 ||
    !Number.isSafeInteger(page.meta.pageSize) ||
    page.meta.pageSize < 1 ||
    page.meta.pageSize > 100 ||
    page.meta.totalPages !== Math.max(1, Math.ceil(page.meta.total / page.meta.pageSize)) ||
    page.data.length > page.meta.pageSize ||
    page.data.some((row) => !row || !Number.isSafeInteger(row.id) || row.id < 1)
  )
    throw new Error("Respuesta de Torreón incompleta. Intenta actualizar.");
  return page;
}

export function arrastreDateError(desde: string, hasta: string): string | null {
  const start = desde ? movementDateBoundary(desde) : null;
  const end = hasta ? movementDateBoundary(hasta, true) : null;
  if ((desde && !start) || (hasta && !end)) return "Revisa las fechas de la consulta.";
  if (start && end && start > end) return "La fecha inicial no puede ser posterior a la final.";
  return null;
}

export function arrastreListUrl(params: {
  localidadId: number;
  page: number;
  pageSize: number;
  history?: boolean;
  shared?: boolean;
  conIncidentes?: boolean;
  q?: string;
  estado?: string;
  vagonEstado?: string;
  fechaCampo?: string;
  desde?: string;
  hasta?: string;
}) {
  const query = new URLSearchParams({
    localidadId: String(params.localidadId),
    pagination: "1",
    vista: params.history ? "historial" : "activos",
    page: String(params.page),
    pageSize: String(params.pageSize),
    includeFotos: "0",
  });
  if (params.conIncidentes) query.set("conIncidentes", "1");
  if (params.shared && !params.history) query.set("alcance", "localidad");
  for (const field of ["q", "estado", "vagonEstado", "fechaCampo", "desde", "hasta"] as const) {
    if (params[field] && params[field] !== "TODOS") query.set(field, params[field]);
  }
  return `/api/cliente/torreon/arrastres?${query}`;
}
