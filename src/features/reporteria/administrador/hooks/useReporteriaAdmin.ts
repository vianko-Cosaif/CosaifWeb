"use client";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../lib/constants";
import { useReportBase } from "./useReportBase";

export function useReporteriaAdmin() {
  return useReportBase({
    endpoint: REPORT_ENDPOINTS.general,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.general,
    filenamePrefix: "reporteria_general",
  });
}
