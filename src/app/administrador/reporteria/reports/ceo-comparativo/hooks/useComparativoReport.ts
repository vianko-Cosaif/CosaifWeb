"use client";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../../../lib/constants";
import { useReportBase } from "../../../hooks/useReportBase";

export function useComparativoReport() {
  return useReportBase({
    endpoint: REPORT_ENDPOINTS.comparativo,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.comparativo,
    filenamePrefix: "reporteria_comparativo",
  });
}
