"use client";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../../../lib/constants";
import { useReportBase } from "../../../hooks/useReportBase";

export function useTurnosReport() {
  return useReportBase({
    endpoint: REPORT_ENDPOINTS.turnos,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.turnos,
    filenamePrefix: "reporteria_turnos",
  });
}
