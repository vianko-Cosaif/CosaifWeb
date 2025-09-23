"use client";

import React from "react";
import SelectLocalidad from "@/app/Components/cliente/SelectLocalidad";
import type { IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";

/* ================= Tipos ================= */
interface ClientPageWrapperProps {
  localidadId: number | null;
  empresaId: number | null;
}

/* ================= Componente Principal ================= */
export default function ClientPageWrapper({ localidadId, empresaId }: ClientPageWrapperProps) {
  // Función para manejar cuando se resuelve un incidente
  const handleIncidentResolved = (incident: IncidenteEmergente) => {
    console.log("Incidente resuelto:", incident);
    // Aquí puedes agregar lógica adicional, como mostrar una notificación
    // o actualizar el estado de la aplicación
  };

  // Función para manejar cuando se omite un incidente
  const handleIncidentSkipped = (incident: IncidenteEmergente) => {
    console.log("Incidente omitido:", incident);
    // Aquí puedes agregar lógica adicional
  };

  // Función para manejar cuando se continúa con un incidente
  const handleIncidentContinued = (incident: IncidenteEmergente) => {
    console.log("Continuando con incidente:", incident);
    // Aquí puedes agregar lógica adicional
  };

  return (
    <>
      
      {/* Contenido principal */}
      <section className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        {localidadId ? (
          <RailQueueBoardWrapper localidadId={localidadId} />
        ) : (
          <SelectLocalidad />
        )}
      </section>
    </>
  );
}

/* ================= Componente Wrapper para RailQueueBoard ================= */
function RailQueueBoardWrapper({ localidadId }: { localidadId: number }) {
  const [RailQueueBoard, setRailQueueBoard] = React.useState<React.ComponentType<{ localidadId: number }> | null>(null);

  React.useEffect(() => {
    // Cargar el componente dinámicamente
    import("./RailQueueBoard").then((module) => {
      setRailQueueBoard(() => module.default);
    });
  }, []);

  if (!RailQueueBoard) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600">Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  return <RailQueueBoard localidadId={localidadId} />;
}
