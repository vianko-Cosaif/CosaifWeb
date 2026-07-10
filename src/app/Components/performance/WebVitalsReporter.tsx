"use client";

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
  useReportWebVitals((metric) => {
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
