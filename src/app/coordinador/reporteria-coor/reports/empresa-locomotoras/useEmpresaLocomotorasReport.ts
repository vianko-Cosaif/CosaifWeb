"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TZ, EMPRESAS_ENDPOINT } from "../../lib/constants";
import { isYYYYMMDD } from "../../lib/utils";
import type { ReporteEmpresaLocomotoras } from "./types";
import { getEmpresaIdClient, getLocIdClient } from "@/lib/cookies";

const ENDPOINT_BFF = "/bff/reporteria/empresa-locomotoras";
const ENDPOINT_PDF_BFF = "/bff/reporteria/empresa-locomotoras/pdf";
const ENDPOINT_EXCEL_BFF = "/bff/reporterias/empresa-locomotoras/excel";
const USUARIO_OBJETIVO = "Jesus Rodriguez";

type Empresa = { id: number; nombre: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { desde: toISODate(start), hasta: toISODate(end) };
}

function previousMonthYM() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRangeFromYM(ym: string) {
  const [yearRaw, monthRaw] = ym.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return previousMonthRange();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { desde: toISODate(start), hasta: toISODate(end) };
}

export function useEmpresaLocomotorasReport() {
  const defaultRange = useRef(previousMonthRange());
  const [modoRango, setModoRango] = useState<"mes" | "fechas">("mes");
  const [mesYM, setMesYMState] = useState(previousMonthYM());
  const [desde, setDesde] = useState(defaultRange.current.desde);
  const [hasta, setHasta] = useState(defaultRange.current.hasta);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [empresaNombre, setEmpresaNombre] = useState("Alstom");
  const [localidadId, setLocalidadId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [pdfUsuarioBusy, setPdfUsuarioBusy] = useState(false);
  const [excelUsuarioBusy, setExcelUsuarioBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReporteEmpresaLocomotoras | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    const loadEmpresa = async () => {
      try {
        const empRes = await fetch(EMPRESAS_ENDPOINT, { credentials: "include", cache: "no-store" });
        if (!empRes.ok) return;
        const empJson = await empRes.json().catch(() => ({}));
        const empList: Empresa[] = Array.isArray(empJson) ? empJson : empJson?.data ?? [];
        if (!active) return;
        const alstom = empList.find((e) => e.nombre?.toLowerCase().includes("alstom"));
        if (alstom) {
          setEmpresaId(String(alstom.id));
          setEmpresaNombre(alstom.nombre);
        } else {
          const fallback = getEmpresaIdClient();
          if (fallback) setEmpresaId(String(fallback));
        }
        const defaultLoc = getLocIdClient();
        if (defaultLoc) setLocalidadId(String(defaultLoc));
      } catch {
        // ignore
      }
    };
    loadEmpresa();
    return () => {
      active = false;
    };
  }, []);

  const setMesYM = useCallback((value: string) => {
    setMesYMState(value);
    const range = monthRangeFromYM(value);
    setDesde(range.desde);
    setHasta(range.hasta);
  }, []);

  const setModoRangoSeguro = useCallback((value: "mes" | "fechas") => {
    setModoRango(value);
    if (value === "mes") {
      const range = monthRangeFromYM(mesYM);
      setDesde(range.desde);
      setHasta(range.hasta);
    }
  }, [mesYM]);

  const validate = useCallback(() => {
    setError(null);
    if (!empresaId) throw new Error("No se encontró empresa.");
    if (!isYYYYMMDD(desde) || !isYYYYMMDD(hasta)) throw new Error("Rango de fechas inválido.");
    if (desde > hasta) throw new Error("La fecha desde no puede ser mayor que hasta.");
    return { desde, hasta };
  }, [empresaId, desde, hasta]);

  const fetchReport = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setLoading(true);
      const { desde: fDesde, hasta: fHasta } = validate();
      const qs = new URLSearchParams({
        empresaId: String(empresaId),
        desde: fDesde,
        hasta: fHasta,
        tz: DEFAULT_TZ,
        usuarioNombre: USUARIO_OBJETIVO,
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${ENDPOINT_BFF}?${qs.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "include",
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      let json: Partial<{ reporte: ReporteEmpresaLocomotoras }> = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }
      const rep = (json.reporte ?? json) as ReporteEmpresaLocomotoras;
      setReport(rep || null);
      if (rep?.meta?.empresaNombre) setEmpresaNombre(rep.meta.empresaNombre);
      setFetchedAt(new Date());
    } catch (e: unknown) {
      setReport(null);
      setFetchedAt(null);
      setError(errorMessage(e, "Error al cargar reporte."));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [validate, empresaId, localidadId]);

  useEffect(() => {
    if (empresaId) fetchReport();
  }, [empresaId, fetchReport]);

  const exportPdf = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setError(null);
    try {
      const { desde: fDesde, hasta: fHasta } = validate();
      const qs = new URLSearchParams({
        empresaId: String(empresaId),
        desde: fDesde,
        hasta: fHasta,
        tz: DEFAULT_TZ,
        usuarioNombre: USUARIO_OBJETIVO,
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${ENDPOINT_PDF_BFF}?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `empresa_locomotoras_${fDesde}_${fHasta}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(errorMessage(e, "No se pudo descargar el PDF."));
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, validate, empresaId, localidadId]);

  const exportExcel = useCallback(async () => {
    if (excelBusy) return;
    setExcelBusy(true);
    setError(null);
    try {
      const { desde: fDesde, hasta: fHasta } = validate();
      const qs = new URLSearchParams({
        empresaId: String(empresaId),
        desde: fDesde,
        hasta: fHasta,
        tz: DEFAULT_TZ,
        usuarioNombre: USUARIO_OBJETIVO,
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${ENDPOINT_EXCEL_BFF}?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `empresa_locomotoras_${fDesde}_${fHasta}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(errorMessage(e, "No se pudo descargar el Excel."));
    } finally {
      setExcelBusy(false);
    }
  }, [excelBusy, validate, empresaId, localidadId]);

  const exportUsuarioPdf = useCallback(async () => {
    if (pdfUsuarioBusy) return;
    setPdfUsuarioBusy(true);
    setError(null);
    try {
      const { desde: fDesde, hasta: fHasta } = validate();
      const qs = new URLSearchParams({
        empresaId: String(empresaId),
        desde: fDesde,
        hasta: fHasta,
        tz: DEFAULT_TZ,
        usuarioNombre: USUARIO_OBJETIVO,
        soloUsuario: "true",
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${ENDPOINT_PDF_BFF}?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `jesus_rodriguez_${fDesde}_${fHasta}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(errorMessage(e, "No se pudo descargar el PDF de Jesus Rodriguez."));
    } finally {
      setPdfUsuarioBusy(false);
    }
  }, [pdfUsuarioBusy, validate, empresaId, localidadId]);

  const exportUsuarioExcel = useCallback(async () => {
    if (excelUsuarioBusy) return;
    setExcelUsuarioBusy(true);
    setError(null);
    try {
      const { desde: fDesde, hasta: fHasta } = validate();
      const qs = new URLSearchParams({
        empresaId: String(empresaId),
        desde: fDesde,
        hasta: fHasta,
        tz: DEFAULT_TZ,
        usuarioNombre: USUARIO_OBJETIVO,
        soloUsuario: "true",
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${ENDPOINT_EXCEL_BFF}?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `jesus_rodriguez_${fDesde}_${fHasta}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(errorMessage(e, "No se pudo descargar el Excel de Jesus Rodriguez."));
    } finally {
      setExcelUsuarioBusy(false);
    }
  }, [excelUsuarioBusy, validate, empresaId, localidadId]);

  return {
    empresaNombre,
    modoRango,
    setModoRango: setModoRangoSeguro,
    mesYM,
    setMesYM,
    usuarioObjetivo: USUARIO_OBJETIVO,
    desde,
    hasta,
    setDesde,
    setHasta,
    report,
    resumen: report?.resumen ?? {},
    locomotoras: report?.locomotoras ?? [],
    movimientos: report?.movimientos ?? [],
    movimientosUsuarioCliente: report?.movimientosUsuarioCliente ?? [],
    loading,
    pdfBusy,
    excelBusy,
    pdfUsuarioBusy,
    excelUsuarioBusy,
    error,
    fetchedAt,
    fetchReport,
    exportPdf,
    exportExcel,
    exportUsuarioPdf,
    exportUsuarioExcel,
  };
}
