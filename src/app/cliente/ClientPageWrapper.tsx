"use client";
import React, { useCallback, Suspense, lazy } from "react";
import SelectLocalidad from "@/app/Components/cliente/SelectLocalidad";
import type { IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
/* ================= Tipos ================= */
interface ClientPageWrapperProps {
  localidadId: number | null;
  empresaId: number | null;
}

interface IncidentHandlers {
  onIncidentResolved: (incident: IncidenteEmergente) => void;
  onIncidentSkipped: (incident: IncidenteEmergente) => void;
  onIncidentContinued: (incident: IncidenteEmergente) => void;
}

/* ================= Componentes de UI ================= */
// Loading component mejorado
function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="relative">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 animate-ping" />
      </div>
      <p className="text-slate-600 dark:text-slate-400 text-lg font-medium mb-2">
        Cargando panel de control
      </p>
      <p className="text-slate-500 dark:text-slate-500 text-sm">
        Preparando la interfaz en tiempo real...
      </p>
    </div>
  );
}

// Error Boundary component
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
    console.error("Error en RailQueueBoard:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Error al cargar el panel
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

/* ================= Lazy Loading con Preload ================= */
// Preload function para cargar el componente en segundo plano
const preloadRailQueueBoard = () => {
  return import("./RailQueueBoard");
};

// Lazy component con preloading
const LazyRailQueueBoard = lazy(() => preloadRailQueueBoard());

/* ================= Componente Principal Mejorado ================= */
export default function ClientPageWrapper({ localidadId, empresaId }: ClientPageWrapperProps) {
  // Memoized handlers para evitar recreaciones innecesarias
  const handleIncidentResolved = useCallback((incident: IncidenteEmergente) => {
    console.log("Incidente resuelto:", incident);
    // Aquí puedes agregar lógica adicional, como mostrar una notificación
    // o actualizar el estado de la aplicación
  }, []);

  const handleIncidentSkipped = useCallback((incident: IncidenteEmergente) => {
    console.log("Incidente omitido:", incident);
    // Aquí puedes agregar lógica adicional
  }, []);

  const handleIncidentContinued = useCallback((incident: IncidenteEmergente) => {
    console.log("Continuando con incidente:", incident);
    // Aquí puedes agregar lógica adicional
  }, []);

  // Preload del componente cuando el wrapper se monta
  React.useEffect(() => {
    if (localidadId) {
      preloadRailQueueBoard();
    }
  }, [localidadId]);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1400px] space-y-6 sm:space-y-8 min-w-0">
        <DynamicBanner />
        <ErrorBoundary>
          {localidadId ? (
            <Suspense fallback={<LoadingFallback />}>
              <LazyRailQueueBoard localidadId={localidadId} />
            </Suspense>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[420px] rounded-2xl border border-slate-200 bg-white/70 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="text-5xl mb-3">🚆</div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Selecciona una Localidad
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Para mostrar el tablero en tiempo real.
              </p>
              <div className="w-full max-w-md">
                <SelectLocalidad />
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

/* ================= Componente de Carga Optimizado (Alternativa) ================= */
/* ================= Tipo del componente dinámico ================= */
type RailQueueBoardProps = {
  localidadId: number;
  autoMs?: number;
  nextCount?: number;
};

/* ================= Componente de Carga Optimizado (Alternativa) ================= */


// Exportación de componentes auxiliares para testing
export {
  LoadingFallback,
  ErrorBoundary,

};
