"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, X, Bell, CheckCircle2, Clock } from "lucide-react";
import type { IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";

/* ================= Tipos ================= */
interface IncidentNotificationProps {
  incident: IncidenteEmergente;
  onDismiss: () => void;
  onView: () => void;
  autoHide?: boolean;
  duration?: number; // en milisegundos
}

/* ================= Componente Principal ================= */
export default function IncidentNotification({
  incident,
  onDismiss,
  onView,
  autoHide = true,
  duration = 10000, // 10 segundos por defecto
}: IncidentNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(duration / 1000);

  // Auto-hide después del tiempo especificado
  useEffect(() => {
    if (!autoHide) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsVisible(false);
          setTimeout(onDismiss, 300); // Esperar a que termine la animación
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoHide, duration, onDismiss]);

  // Manejar clic en ver
  const handleView = () => {
    onView();
    onDismiss();
  };

  // Manejar clic en cerrar
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-right-full duration-300">
      <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Nuevo Incidente</h3>
              <p className="text-xs text-amber-700">Requiere atención inmediata</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-amber-600 hover:bg-amber-100 transition-colors"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="mt-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-amber-800 font-medium line-clamp-2">
                {incident.descripcion}
              </p>
              <div className="mt-2 flex items-center gap-4 text-xs text-amber-700">
                {incident.empresa && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Empresa:</span>
                    {incident.empresa}
                  </span>
                )}
                {incident.locomotora && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">Locomotora:</span>
                    #{incident.locomotora}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Clock className="h-3 w-3" />
            <span>
              {autoHide && timeLeft > 0 ? `Se oculta en ${timeLeft}s` : "Ahora"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleView}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Ver Detalles
            </button>
          </div>
        </div>

        {/* Barra de progreso para auto-hide */}
        {autoHide && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-amber-200">
            <div
              className="h-full bg-amber-600 transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / (duration / 1000)) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
