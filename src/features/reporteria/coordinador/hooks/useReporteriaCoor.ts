"use client";

import { cachedFetchJson } from "@/lib/http/client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DayBucket,
  Empresa,
  HourBucket,
  Localidad,
  PeriodoBack,
  PeriodoUI,
  Reporte,
  Tab,
} from "../lib/types";
import {
  COOR_REPORT_ENDPOINT,
  COOR_REPORT_PDF_ENDPOINT,
  DEFAULT_TZ,
  EMPRESAS_ENDPOINT,
  LOCALIDADES_ENDPOINT,
} from "../lib/constants";
import { buildAnchorFecha, clampInt, isYYYYMM, isYYYYMMDD, n, todayISO, weekMondayISO } from "../lib/utils";

const PERIOD_BACK: Record<PeriodoUI, PeriodoBack> = {
  dia: "DIA",
  semana: "SEMANA",
  mes: "MES",
  bimestre: "BIMESTRE",
  semestre: "SEMESTRE",
  anual: "ANUAL",
};

export function useReporteriaCoor(assignedLocalidadId: number) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const currentBim = Math.floor((thisMonth - 1) / 2) + 1;
  const currentSem = thisMonth <= 6 ? 1 : 2;

  const [periodo, setPeriodo] = useState<PeriodoUI>("dia");
  const [diaISO, setDiaISO] = useState<string>(todayISO());
  const [semanaISO, setSemanaISORaw] = useState<string>(weekMondayISO());
  const [mesYM, setMesYM] = useState<string>(`${thisYear}-${String(thisMonth).padStart(2, "0")}`);
  const [bimYear, setBimYear] = useState<number>(thisYear);
  const [bimIndex, setBimIndex] = useState<number>(currentBim);
  const [semYear, setSemYear] = useState<number>(thisYear);
  const [semIndex, setSemIndex] = useState<number>(currentSem);
  const [anio, setAnio] = useState<number>(thisYear);

  const [empresaId, setEmpresaId] = useState<string>("");
  const localidadId = String(assignedLocalidadId);
  const setLocalidadId = useCallback(() => {}, []);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const lockEmpresa = false;
  const lockLocalidad = true;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; report: Reporte | null; fetchedAt: Date } | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const periodoBack = PERIOD_BACK[periodo];

  const anchorFecha = useMemo(() => {
    return buildAnchorFecha({
      periodo,
      diaISO,
      semanaISO,
      mesYM,
      bimYear,
      bimIndex,
      semYear,
      semIndex,
      anio,
    });
  }, [periodo, diaISO, semanaISO, mesYM, bimYear, bimIndex, semYear, semIndex, anio]);

  const setSemanaISO = useCallback((value: string) => {
    setSemanaISORaw(weekMondayISO(value));
  }, []);

  const queryKey = `${COOR_REPORT_ENDPOINT}|${periodoBack}|${anchorFecha}|${empresaId}|${localidadId}`;
  const report = snapshot?.key === queryKey ? snapshot.report : null;
  const fetchedAt = snapshot?.key === queryKey ? snapshot.fetchedAt : null;

  useEffect(() => {
    const controller = new AbortController();
    const loadOptions = async () => {
      try {
        const [empJson, locJson] = await Promise.all([
          cachedFetchJson<Empresa[] | { data?: Empresa[] }>(EMPRESAS_ENDPOINT, { credentials: "include", signal: controller.signal }, { ttlMs: 300_000 }),
          cachedFetchJson<Localidad[] | { data?: Localidad[] }>(LOCALIDADES_ENDPOINT, { credentials: "include", signal: controller.signal }, { ttlMs: 300_000 }),
        ]);
        const empList: Empresa[] = Array.isArray(empJson) ? empJson : empJson?.data ?? [];
        const locList: Localidad[] = Array.isArray(locJson) ? locJson : locJson?.data ?? [];
        if (controller.signal.aborted) return;
        setEmpresas(empList);
        setLocalidades(locList);
      } catch {
        // ignore
      }
    };
    loadOptions();
    return () => {
      controller.abort();
    };
  }, []);

  const filteredLocalidades = useMemo(() => {
    const assigned = localidades.filter((item) => item.id === assignedLocalidadId);
    return assigned.length ? assigned : [{ id: assignedLocalidadId, nombre: `Localidad #${assignedLocalidadId}` }];
  }, [localidades, assignedLocalidadId]);

  const validate = useCallback(() => {
    setError(null);
    if (periodo === "dia" && !isYYYYMMDD(diaISO)) throw new Error("Fecha inválida para Día.");
    if (periodo === "semana" && !isYYYYMMDD(semanaISO)) throw new Error("Fecha inválida para Semana.");
    if (periodo === "mes" && !isYYYYMM(mesYM)) throw new Error("Mes inválido.");

    if (periodo === "bimestre") {
      const y = clampInt(bimYear, 2000, 2100);
      const b = clampInt(bimIndex, 1, 6);
      if (y !== bimYear) setBimYear(y);
      if (b !== bimIndex) setBimIndex(b);
    }
    if (periodo === "semestre") {
      const y = clampInt(semYear, 2000, 2100);
      const s = clampInt(semIndex, 1, 2);
      if (y !== semYear) setSemYear(y);
      if (s !== semIndex) setSemIndex(s);
    }
    if (periodo === "anual") {
      const y = clampInt(anio, 2000, 2100);
      if (y !== anio) setAnio(y);
    }

    return { periodoBack, fecha: anchorFecha };
  }, [periodo, diaISO, semanaISO, mesYM, bimYear, bimIndex, semYear, semIndex, anio, anchorFecha, periodoBack]);

  const fetchReport = useCallback(async (force = true) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      setLoading(true);
      const { periodoBack: pBack, fecha } = validate();
      const qs = new URLSearchParams({ fecha, periodo: pBack });
      qs.set("tz", DEFAULT_TZ);
      if (empresaId) qs.set("empresaId", String(empresaId));
      if (localidadId) qs.set("localidadId", String(localidadId));

      const json = await cachedFetchJson(`${COOR_REPORT_ENDPOINT}?${qs}`, { credentials: "include", signal: controller.signal }, { force, ttlMs: 20_000 });
      if (controller.signal.aborted) return;
      const rep = ((json && typeof json === "object" && "reporte" in json ? json.reporte : json)) as Reporte;
      setSnapshot({ key: queryKey, report: rep || null, fetchedAt: new Date() });
    } catch (e: unknown) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Error al cargar reportería.");
    } finally {
      if (requestRef.current === controller) { setLoading(false); requestRef.current = null; }
    }
  }, [validate, empresaId, localidadId, queryKey]);

  useEffect(() => {
    void fetchReport(false);
    return () => requestRef.current?.abort();
  }, [fetchReport]);

  const exportPdf = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setError(null);
    try {
      const { periodoBack: pBack, fecha } = validate();
      const qs = new URLSearchParams({ fecha, periodo: pBack, tz: DEFAULT_TZ });
      if (empresaId) qs.set("empresaId", String(empresaId));
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${COOR_REPORT_PDF_ENDPOINT}?${qs.toString()}`, {
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
      link.download = `reporteria_coordinador_${pBack}_${fecha}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el PDF.");
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, validate, empresaId, localidadId]);

  const kpis = report?.kpis ?? {};
  const movimientosHora = useMemo(() => {
    const raw = report?.movimientosPorHora ?? [];
    return [...raw].sort((a, b) => Number(a.hora) - Number(b.hora));
  }, [report?.movimientosPorHora]);
  const movimientosDia = useMemo(() => report?.movimientosPorDiaSemana ?? [], [report?.movimientosPorDiaSemana]);
  const incidentesHora = useMemo(() => {
    const raw = report?.incidentesPorHora ?? [];
    return [...raw].sort((a, b) => Number(a.hora) - Number(b.hora));
  }, [report?.incidentesPorHora]);
  const incidentesDia = useMemo(() => report?.incidentesPorDiaSemana ?? [], [report?.incidentesPorDiaSemana]);

  const totalMov = n(kpis.totalMovimientos);
  const meanHora = useMemo(() => {
    if (!movimientosHora.length) return 0;
    const sum = movimientosHora.reduce((acc, d) => acc + n(d.movimientos), 0);
    return sum / movimientosHora.length;
  }, [movimientosHora]);

  const meanDia = useMemo(() => {
    if (!movimientosDia.length) return 0;
    const sum = movimientosDia.reduce((acc, d) => acc + n(d.movimientos), 0);
    return sum / movimientosDia.length;
  }, [movimientosDia]);

  const meanIncHora = useMemo(() => {
    if (!incidentesHora.length) return 0;
    const sum = incidentesHora.reduce((acc, d) => acc + n(d.incidentes), 0);
    return sum / incidentesHora.length;
  }, [incidentesHora]);

  const meanIncDia = useMemo(() => {
    if (!incidentesDia.length) return 0;
    const sum = incidentesDia.reduce((acc, d) => acc + n(d.incidentes), 0);
    return sum / incidentesDia.length;
  }, [incidentesDia]);

  const peakHora = useMemo<HourBucket | null>(() => {
    if (!movimientosHora.length) return null;
    return movimientosHora.reduce((max, cur) =>
      n(cur.movimientos) > n(max.movimientos) ? cur : max
    );
  }, [movimientosHora]);

  const peakDia = useMemo<DayBucket | null>(() => {
    if (!movimientosDia.length) return null;
    return movimientosDia.reduce((max, cur) =>
      n(cur.movimientos) > n(max.movimientos) ? cur : max
    );
  }, [movimientosDia]);

  const peakIncHora = useMemo(() => {
    if (!incidentesHora.length) return null;
    return incidentesHora.reduce((max, cur) =>
      n(cur.incidentes) > n(max.incidentes) ? cur : max
    );
  }, [incidentesHora]);

  const peakIncDia = useMemo(() => {
    if (!incidentesDia.length) return null;
    return incidentesDia.reduce((max, cur) =>
      n(cur.incidentes) > n(max.incidentes) ? cur : max
    );
  }, [incidentesDia]);

  return {
    report,
    kpis,
    movimientosHora,
    movimientosDia,
    incidentesHora,
    incidentesDia,
    estadosGeneral: report?.estadosGeneral ?? {},
    topEmpresas: report?.topEmpresas ?? [],
    topLocomotoras: report?.topLocomotoras ?? [],
    movimientosDetalle: report?.movimientosDetalle ?? [],
    cronologiaMovimientos: report?.cronologiaMovimientos ?? [],
    meanHora,
    meanDia,
    meanIncHora,
    meanIncDia,
    peakHora,
    peakDia,
    peakIncHora,
    peakIncDia,
    totalMov,
    periodo,
    setPeriodo,
    diaISO,
    setDiaISO,
    semanaISO,
    setSemanaISO,
    mesYM,
    setMesYM,
    bimYear,
    setBimYear,
    bimIndex,
    setBimIndex,
    semYear,
    setSemYear,
    semIndex,
    setSemIndex,
    anio,
    setAnio,
    empresaId,
    setEmpresaId,
    localidadId,
    setLocalidadId,
    empresas,
    filteredLocalidades,
    lockEmpresa,
    lockLocalidad,
    activeTab,
    setActiveTab,
    loading,
    pdfBusy,
    error,
    fetchedAt,
    fetchReport: () => fetchReport(true),
    exportPdf,
  };
}
