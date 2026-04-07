"use client";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../../../lib/constants";
import { useReportBase } from "../../../hooks/useReportBase";

export function useCumplimientoReport() {
  return useReportBase({
    endpoint: REPORT_ENDPOINTS.cumplimiento,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.cumplimiento,
    filenamePrefix: "reporteria_cumplimiento",
  });
}
