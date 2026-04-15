"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TZ, EMPRESAS_ENDPOINT } from "../../lib/constants";
import { daysAgoISO, isYYYYMMDD, todayISO } from "../../lib/utils";
import type { ReporteEmpresaLocomotoras } from "./types";
import { getEmpresaIdClient, getLocIdClient } from "@/lib/cookies";

const ENDPOINT = "/reporteria/empresa-locomotoras";
const ENDPOINT_BFF = "/bff/reporteria/empresa-locomotoras";
const ENDPOINT_PDF = "/reporteria/empresa-locomotoras/pdf";
const ENDPOINT_PDF_BFF = "/bff/reporteria/empresa-locomotoras/pdf";

const DEFAULT_RANGE_DAYS = 30;

type Empresa = { id: number; nombre: string };

export function useEmpresaLocomotorasReport() {
  const [desde, setDesde] = useState(daysAgoISO(DEFAULT_RANGE_DAYS));
  const [hasta, setHasta] = useState(todayISO());
  const [empresaId, setEmpresaId] = useState<string>("");
  const [empresaNombre, setEmpresaNombre] = useState("Alstom");
  const [localidadId, setLocalidadId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
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
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      let res = await fetch(`${ENDPOINT}?${qs.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 404) {
        res = await fetch(`${ENDPOINT_BFF}?${qs.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "include",
        });
      }
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }
      const rep = (json?.reporte ?? json) as ReporteEmpresaLocomotoras;
      setReport(rep || null);
      if (rep?.meta?.empresaNombre) setEmpresaNombre(rep.meta.empresaNombre);
      setFetchedAt(new Date());
    } catch (e: any) {
      setError(e?.message || "Error al cargar reporte.");
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
      });
      if (localidadId) qs.set("localidadId", String(localidadId));

      let res = await fetch(`${ENDPOINT_PDF}?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (res.status === 404) {
        res = await fetch(`${ENDPOINT_PDF_BFF}?${qs.toString()}`, {
          method: "GET",
          credentials: "include",
        });
      }
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
    } catch (e: any) {
      setError(e?.message || "No se pudo descargar el PDF.");
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, validate, empresaId, localidadId]);

  return {
    empresaNombre,
    desde,
    hasta,
    setDesde,
    setHasta,
    report,
    resumen: report?.resumen ?? {},
    locomotoras: report?.locomotoras ?? [],
    movimientos: report?.movimientos ?? [],
    loading,
    pdfBusy,
    error,
    fetchedAt,
    fetchReport,
    exportPdf,
  };
}
