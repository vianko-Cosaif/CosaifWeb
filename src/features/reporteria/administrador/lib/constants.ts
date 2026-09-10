export const REPORT_ENDPOINTS = {
  general: "/bff/reporteria/admin",
  cumplimiento: "/bff/reporteria/ceo/cumplimiento",
  traficoCliente: "/bff/reporteria/ceo/trafico-cliente",
  turnos: "/bff/reporteria/ceo/turnos",
  maquinistas: "/bff/reporteria/ceo/maquinistas",
  comparativo: "/bff/reporteria/ceo/comparativo",
  coordinador: "/bff/reporteria/coordinador",
} as const;

export const REPORT_PDF_ENDPOINTS = {
  general: "/bff/reporteria/admin/pdf",
  cumplimiento: "/bff/reporteria/ceo/cumplimiento/pdf",
  traficoCliente: "/bff/reporteria/ceo/trafico-cliente/pdf",
  turnos: "/bff/reporteria/ceo/turnos/pdf",
  maquinistas: "/bff/reporteria/ceo/maquinistas/pdf",
  comparativo: "/bff/reporteria/ceo/comparativo/pdf",
  coordinador: "/bff/reporteria/coordinador/pdf",
} as const;
export const EMPRESAS_ENDPOINT = "/bff/empresas/lite";
export const LOCALIDADES_ENDPOINT = "/bff/localidades/lite";
export const DEFAULT_TZ = "America/Mexico_City";
