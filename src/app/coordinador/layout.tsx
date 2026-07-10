// src/app/coordinador/layout.tsx
"use client";

import { useEffect, useState } from "react";
import AdaptiveAppShell from "@/app/Components/layout/AdaptiveAppShell";
import dynamic from "next/dynamic";

const ScopedIncidentMonitor = dynamic(
  () => import("@/app/Components/IncidentModal/ScopedIncidentMonitor"),
  { ssr: false }
);

export default function CoordinadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [monitorReady, setMonitorReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMonitorReady(true), 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <AdaptiveAppShell
      beforeMain={monitorReady ? <ScopedIncidentMonitor scope="localidad" intervalMs={60000} /> : null}
      footerClassName="text-[var(--app-text-soft)]"
    >
      {children}
    </AdaptiveAppShell>
  );
}
