"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import {
  GuidedManualProvider,
  useGuidedManualApi,
} from ".";
import {
  CLIENT_MOVEMENT_GUIDE,
  CLIENT_MOVEMENT_GUIDE_ID,
} from "./ClientMovementGuide.config";

export function ClientMovementGuideProvider({ children }: { children: ReactNode }) {
  return (
    <GuidedManualProvider
      manuals={[CLIENT_MOVEMENT_GUIDE]}
      defaultManualId={CLIENT_MOVEMENT_GUIDE_ID}
      transition={{
        waitForTarget: true,
        targetStableMs: 120,
        targetTimeoutMs: 12_000,
      }}
      appearance={{
        colors: {
          accent: "#10b981",
          panelBg: "rgba(15, 23, 42, 0.97)",
          panelBorder: "rgba(16, 185, 129, 0.45)",
          buttonPrimaryBg: "rgba(16, 185, 129, 0.28)",
        },
        layout: {
          spotlightPadding: 8,
          spotlightRadius: 12,
          panelWidth: 360,
          panelRadius: 12,
        },
      }}
      copy={{
        start: "Crear un movimiento",
        next: "Continuar",
        finish: "Finalizar",
      }}
    >
      {children}
    </GuidedManualProvider>
  );
}

export function ClientMovementGuideButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const api = useGuidedManualApi();

  if (!api) return null;

  return (
    <button
      type="button"
      onClick={() => api.startManual(CLIENT_MOVEMENT_GUIDE_ID)}
      className={className}
      title="Guia para crear un movimiento"
      aria-label="Iniciar guia para crear un movimiento"
    >
      <CircleHelp aria-hidden className="h-4 w-4" />
      {!compact && <span>Guia</span>}
    </button>
  );
}
