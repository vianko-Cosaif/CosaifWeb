"use client";

import { ReactNode, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import {
  GuidedManualProvider,
  useGuidedManualApi,
  GuidedManualAction,
} from ".";
import {
  CLIENT_MOVEMENT_GUIDE,
  CLIENT_MOVEMENT_GUIDE_ID,
  CLIENT_MOVEMENT_MOBILE_GUIDE,
} from "./ClientMovementGuide.config";

function getRoleBaseFromPathname(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "cliente" && parts[1] === "torreon") {
    return "/cliente/torreon";
  }
  if (["cliente", "coordinador", "administrador", "supervisor"].includes(parts[0])) {
    return `/${parts[0]}`;
  }
  return "/cliente";
}

export function ClientMovementGuideProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const actionRunner = useCallback(
    (action: GuidedManualAction) => {
      const delayMs = Math.max(0, Number(action.delayMs || 0));

      const execute = () => {
        if (action.type === "click" && action.selector) {
          const node = document.querySelector(action.selector) as HTMLElement | null;
          node?.click();
          return;
        }

        if (action.type !== "event") return;

        const baseFromAction =
          typeof action.detail?.base === "string" && action.detail.base.trim()
            ? action.detail.base.trim()
            : getRoleBaseFromPathname(pathname);

        if (action.eventName === "guide:navigate-role-movements") {
          router.push(`${baseFromAction}/movimientos`);
          return;
        }

        if (action.eventName === "guide:navigate-create-movement") {
          router.push("/movimientos/crear");
        }
      };

      if (delayMs > 0) {
        window.setTimeout(execute, delayMs);
        return delayMs;
      }

      execute();
      return 0;
    },
    [router, pathname]
  );

  return (
    <GuidedManualProvider
      manuals={[CLIENT_MOVEMENT_GUIDE, CLIENT_MOVEMENT_MOBILE_GUIDE]}
      defaultManualId={CLIENT_MOVEMENT_GUIDE_ID}
      actionRunner={actionRunner}
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
