"use client";

import type { CumplimientoReportData } from "../../types";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../../../lib/constants";
import { useReportBase } from "../../../hooks/useReportBase";

export function useCumplimientoReport() {
  return useReportBase<CumplimientoReportData>({
    endpoint: REPORT_ENDPOINTS.cumplimiento,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.cumplimiento,
    filenamePrefix: "reporteria_cumplimiento",
  });
}
