"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Bucket,
  DayBucket,
  Empresa,
  HourBucket,
  Localidad,
  PeriodoBack,
  PeriodoUI,
  Reporte,
  Tab,
} from "../lib/types";
import { DEFAULT_TZ, EMPRESAS_ENDPOINT, LOCALIDADES_ENDPOINT } from "../lib/constants";
import { buildAnchorFecha, clampInt, isYYYYMM, isYYYYMMDD, n, todayISO } from "../lib/utils";

const PERIOD_BACK: Record<PeriodoUI, PeriodoBack> = {
  dia: "DIA",
  semana: "SEMANA",
  mes: "MES",
  bimestre: "BIMESTRE",
  semestre: "SEMESTRE",
  anual: "ANUAL",
};

export function useReportBase({
  endpoint,
  pdfEndpoint,
  filenamePrefix = "reporteria",
  initialTab = "overview",
}: {
  endpoint: string;
  pdfEndpoint: string;
  filenamePrefix?: string;
  initialTab?: Tab;
}) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const currentBim = Math.floor((thisMonth - 1) / 2) + 1;
  const currentSem = thisMonth <= 6 ? 1 : 2;

  const [periodo, setPeriodo] = useState<PeriodoUI>("dia");
  const [diaISO, setDiaISO] = useState<string>(todayISO());
  const [semanaISO, setSemanaISO] = useState<string>(todayISO());
  const [mesYM, setMesYM] = useState<string>(`${thisYear}-${String(thisMonth).padStart(2, "0")}`);
  const [bimYear, setBimYear] = useState<number>(thisYear);
  const [bimIndex, setBimIndex] = useState<number>(currentBim);
  const [semYear, setSemYear] = useState<number>(thisYear);
  const [semIndex, setSemIndex] = useState<number>(currentSem);
  const [anio, setAnio] = useState<number>(thisYear);

  const [empresaId, setEmpresaId] = useState<string>("");
  const [localidadId, setLocalidadId] = useState<string>("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Reporte | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const inFlightRef = useRef(false);

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

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      try {
        const [empRes, locRes] = await Promise.all([
          fetch(EMPRESAS_ENDPOINT, { credentials: "include", cache: "no-store" }),
          fetch(LOCALIDADES_ENDPOINT, { credentials: "include", cache: "no-store" }),
        ]);
        if (!empRes.ok || !locRes.ok) return;
        const empJson = await empRes.json().catch(() => ({}));
        const locJson = await locRes.json().catch(() => ({}));
        const empList: Empresa[] = Array.isArray(empJson) ? empJson : empJson?.data ?? [];
        const locList: Localidad[] = Array.isArray(locJson) ? locJson : locJson?.data ?? [];
        if (!active) return;
        setEmpresas(empList);
        setLocalidades(locList);
      } catch {
        // silencioso
      }
    };
    loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const filteredLocalidades = useMemo(() => {
    if (!empresaId) return localidades;
    const hasEmpresa = localidades.some((l) => l.empresaId != null);
    if (!hasEmpresa) return localidades;
    return localidades.filter((l) => String(l.empresaId ?? "") === String(empresaId));
  }, [empresaId, localidades]);

  useEffect(() => {
    if (!localidadId) return;
    const stillExists = filteredLocalidades.some((l) => String(l.id) === String(localidadId));
    if (!stillExists) setLocalidadId("");
  }, [filteredLocalidades, localidadId]);

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

  const fetchReport = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setLoading(true);
      const { periodoBack: pBack, fecha } = validate();
      const qs = new URLSearchParams({ fecha, periodo: pBack });
      qs.set("tz", DEFAULT_TZ);
      if (empresaId) qs.set("empresaId", String(empresaId));
      if (localidadId) qs.set("localidadId", String(localidadId));

      const res = await fetch(`${endpoint}?${qs.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "include",
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }
      const rep = (json?.reporte ?? json) as Reporte;
      setReport(rep || null);
      setFetchedAt(new Date());
    } catch (e: any) {
      setError(e?.message || "Error al cargar reportería.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [validate, empresaId, localidadId, endpoint]);

  useEffect(() => {
    fetchReport();
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

      const res = await fetch(`${pdfEndpoint}?${qs.toString()}`, {
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
      link.download = `${filenamePrefix}_${pBack}_${fecha}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "No se pudo descargar el PDF.");
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, validate, empresaId, localidadId, pdfEndpoint, filenamePrefix]);

  const rawReport = report;
  const meta = report?.meta ?? {};
  const kpis = report?.kpis ?? {};
  const ejecucionBuckets = report?.ejecucionBuckets ?? [];
  const movimientosHora = useMemo(() => {
    const raw = report?.movimientosPorHora ?? [];
    return [...raw].sort((a, b) => Number(a.hora) - Number(b.hora));
  }, [report?.movimientosPorHora]);
  const movimientosDia = report?.movimientosPorDiaSemana ?? [];
  const incidentesHora = useMemo(() => {
    const raw = report?.incidentesPorHora ?? [];
    return [...raw].sort((a, b) => Number(a.hora) - Number(b.hora));
  }, [report?.incidentesPorHora]);
  const incidentesDia = report?.incidentesPorDiaSemana ?? [];
  const incidentesEstado = useMemo(() => {
    const raw = report?.incidentes?.porEstado ?? {};
    return Object.entries(raw).map(([estado, total]) => ({ estado, total: n(total) }));
  }, [report?.incidentes?.porEstado]);

  const rankingOperadores = report?.rankingOperadores ?? [];
  const rankingLocomotoras = report?.rankingLocomotoras ?? [];
  const rankingEmpresas = report?.rankingEmpresas ?? [];
  const rankingClientes = report?.rankingClientes ?? [];
  const rankingSupervisores = report?.rankingSupervisores ?? [];
  const rankingCoordinadores = report?.rankingCoordinadores ?? [];
  const rankingLocalidades = report?.rankingLocalidades ?? [];
  const topLocos = report?.topLocomotorasIncidentes ?? [];
  const topCriticos = report?.topCriticos ?? [];
  const topIncidentes = report?.topIncidentes ?? [];
  const insights = report?.insights ?? [];

  const ejecucionData = useMemo(
    () => ejecucionBuckets.map((b) => ({ ...b, pct: n(b.pct) })),
    [ejecucionBuckets]
  );

  const meanExec = useMemo(() => {
    if (ejecucionData.length === 0) return 0;
    const sum = ejecucionData.reduce((acc, d) => acc + n(d.movimientos), 0);
    return sum / ejecucionData.length;
  }, [ejecucionData]);

  const meanPct = useMemo(() => {
    if (ejecucionData.length === 0) return 0;
    const sum = ejecucionData.reduce((acc, d) => acc + n(d.pct), 0);
    return sum / ejecucionData.length;
  }, [ejecucionData]);

  const meanHora = useMemo(() => {
    if (movimientosHora.length === 0) return 0;
    const sum = movimientosHora.reduce((acc, d) => acc + n(d.movimientos), 0);
    return sum / movimientosHora.length;
  }, [movimientosHora]);

  const meanDia = useMemo(() => {
    if (movimientosDia.length === 0) return 0;
    const sum = movimientosDia.reduce((acc, d) => acc + n(d.movimientos), 0);
    return sum / movimientosDia.length;
  }, [movimientosDia]);

  const meanIncHora = useMemo(() => {
    if (incidentesHora.length === 0) return 0;
    const sum = incidentesHora.reduce((acc, d) => acc + n(d.incidentes), 0);
    return sum / incidentesHora.length;
  }, [incidentesHora]);

  const meanIncDia = useMemo(() => {
    if (incidentesDia.length === 0) return 0;
    const sum = incidentesDia.reduce((acc, d) => acc + n(d.incidentes), 0);
    return sum / incidentesDia.length;
  }, [incidentesDia]);

  const peakHora = useMemo<HourBucket | null>(() => {
    if (movimientosHora.length === 0) return null;
    return movimientosHora.reduce((max, cur) =>
      n(cur.movimientos) > n(max.movimientos) ? cur : max
    );
  }, [movimientosHora]);

  const peakDia = useMemo<DayBucket | null>(() => {
    if (movimientosDia.length === 0) return null;
    return movimientosDia.reduce((max, cur) =>
      n(cur.movimientos) > n(max.movimientos) ? cur : max
    );
  }, [movimientosDia]);

  const peakIncHora = useMemo(() => {
    if (incidentesHora.length === 0) return null;
    return incidentesHora.reduce((max, cur) =>
      n(cur.incidentes) > n(max.incidentes) ? cur : max
    );
  }, [incidentesHora]);

  const peakIncDia = useMemo(() => {
    if (incidentesDia.length === 0) return null;
    return incidentesDia.reduce((max, cur) =>
      n(cur.incidentes) > n(max.incidentes) ? cur : max
    );
  }, [incidentesDia]);

  const execMax = useMemo<Bucket | null>(() => {
    if (ejecucionData.length === 0) return null;
    return ejecucionData.reduce((max, cur) =>
      n(cur.movimientos) > n(max.movimientos) ? cur : max
    );
  }, [ejecucionData]);

  const totalMov = n(kpis.totalMovimientos);
  const conInicioFin = n(kpis.totalConInicioFin ?? kpis.totalConFin);
  const sinFin = n(kpis.totalSinFin);
  const completionPct = totalMov ? (conInicioFin / totalMov) * 100 : 0;
  const sinFinPct = totalMov ? (sinFin / totalMov) * 100 : 0;

  const sparkData = movimientosHora.map((d) => ({ x: d.hora, y: n(d.movimientos) }));

  return {
    rawReport,
    pdfBusy,
    exportPdf,
    loading,
    error,
    fetchedAt,
    fetchReport,
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
    localidades,
    filteredLocalidades,
    activeTab,
    setActiveTab,
    periodoBack,
    anchorFecha,
    meta,
    kpis,
    ejecucionData,
    movimientosHora,
    movimientosDia,
    incidentesHora,
    incidentesDia,
    incidentesEstado,
    rankingOperadores,
    rankingLocomotoras,
    rankingEmpresas,
    rankingClientes,
    rankingSupervisores,
    rankingCoordinadores,
    rankingLocalidades,
    topLocos,
    topCriticos,
    topIncidentes,
    insights,
    meanExec,
    meanPct,
    meanHora,
    meanDia,
    meanIncHora,
    meanIncDia,
    peakHora,
    peakDia,
    peakIncHora,
    peakIncDia,
    execMax,
    totalMov,
    conInicioFin,
    sinFin,
    completionPct,
    sinFinPct,
    sparkData,
  };
}
