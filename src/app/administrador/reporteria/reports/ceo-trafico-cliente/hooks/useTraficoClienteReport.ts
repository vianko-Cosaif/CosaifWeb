"use client";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../../../lib/constants";
import { useReportBase } from "../../../hooks/useReportBase";

export function useTraficoClienteReport() {
  return useReportBase({
    endpoint: REPORT_ENDPOINTS.traficoCliente,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.traficoCliente,
    filenamePrefix: "reporteria_trafico_cliente",
  });
}
