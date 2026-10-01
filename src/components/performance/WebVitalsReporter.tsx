"use client";

import { useEffect } from "react";
import { reportClientEvent, flushTelemetry } from "@/lib/observability/client";
import { useReportWebVitals } from "next/web-vitals";

const STORAGE_KEY = "cosaif:web-vitals:v1";

type StoredMetric = {
  id: string;
  name: string;
  value: number;
  rating?: string;
  path: string;
  at: string;
};

export default function WebVitalsReporter() {
  useEffect(() => {
    const flush = () => { if (document.visibilityState === "hidden") flushTelemetry(); };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushTelemetry);
    return () => { document.removeEventListener("visibilitychange", flush); window.removeEventListener("pagehide", flushTelemetry); };
  }, []);
  useReportWebVitals((metric) => {
    reportClientEvent({ kind: "vital", name: metric.name, value: metric.value });
    const entry: StoredMetric = {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: "rating" in metric ? String(metric.rating || "") : undefined,
      path: window.location.pathname,
      at: new Date().toISOString(),
    };

    try {
      const previous = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]") as StoredMetric[];
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...previous.slice(-49), entry]));
    } catch {
      // La medicion sigue disponible por el evento aunque sessionStorage falle.
    }

    window.dispatchEvent(new CustomEvent("cosaif:web-vital", { detail: entry }));
    if (process.env.NODE_ENV === "development") console.debug("[web-vital]", entry);
  });

  return null;
}
