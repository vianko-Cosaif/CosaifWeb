// src/app/supervisor/SupervisorPageWrapper.tsx
"use client";

import React, { useCallback, Suspense, lazy } from "react";
import type { IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";

/* ================= Tipos ================= */
interface SupervisorPageWrapperProps {
  localidadId: number | null;
  empresaId: number | null;
}

/* ================= Componentes de UI ================= */
function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="relative">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 animate-ping" />
      </div>
  
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error en RailQueueBoard (SUPERVISOR):", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Error al cargar el panel del supervisor
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md">
            Ha ocurrido un error inesperado al cargar el tablero de control.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ================= Lazy Loading ================= */

export { LoadingFallback, ErrorBoundary };