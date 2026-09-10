"use client";

import type { MaquinistasReportData } from "../../types";

import { REPORT_ENDPOINTS, REPORT_PDF_ENDPOINTS } from "../../../lib/constants";
import { useReportBase } from "../../../hooks/useReportBase";

export function useMaquinistasReport() {
  return useReportBase<MaquinistasReportData>({
    endpoint: REPORT_ENDPOINTS.maquinistas,
    pdfEndpoint: REPORT_PDF_ENDPOINTS.maquinistas,
    filenamePrefix: "reporteria_maquinistas",
    initialTab: "rankings",
  });
}
