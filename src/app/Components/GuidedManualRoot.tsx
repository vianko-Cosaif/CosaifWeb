"use client";

import React, { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GuidedManualProvider,
  useGuidedManualApi,
  type GuidedManualAction,
  type GuidedManualStep,
} from "@/app/Components/GuidedManualAtom";

const START_CREATE_MOVEMENT_GUIDE_EVENT = "cosaif:start-create-movement-guide";

function getRoleBaseFromPathname(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  if (["administrador", "coordinador", "supervisor", "cliente"].includes(firstSegment)) {
    return `/${firstSegment}`;
  }
  return "/cliente";
}

function buildCreateMovementGuideSteps(roleBase: string): GuidedManualStep[] {
  return [
    {
      id: "open-sidebar-movements",
      targetId: "sidebar-menu-movimientos",
      title: "Abre el módulo de movimientos",
      description: "Empieza desde este botón del menú lateral. Aquí entras a la pantalla donde se consultan y crean movimientos.",
      mode: "wizard",
      actionOnNext: {
        type: "event",
        eventName: "guide:navigate-role-movements",
        detail: { base: roleBase },
        delayMs: 350,
      },
    },
    {
      id: "open-new-movement-form",
      targetId: "movimientos-new-button",
      title: "Crea un nuevo movimiento",
      description: "En esta pantalla usa el botón Nuevo para abrir el formulario de captura.",
      mode: "wizard",
      actionOnNext: {
        type: "event",
        eventName: "guide:navigate-create-movement",
        detail: { base: roleBase },
        delayMs: 350,
      },
    },
    {
      id: "understand-create-movement-steps",
      targetId: "create-movement-stepper",
      title: "El formulario está dividido por pasos",
      description: "Primero capturas los datos base, después completas los detalles y al final revisas la confirmación.",
      mode: "guide",
    },
    {
      id: "fill-create-movement-form",
      targetId: "create-movement-step-content",
      title: "Llena el formulario con calma",
      description: "Comienza con empresa, localidad, servicio, vías y locomotora. El sistema te irá guiando según el tipo de movimiento.",
      mode: "wizard",
    },
    {
      id: "continue-create-movement-flow",
      targetId: "create-movement-next-step",
      title: "Continúa al siguiente bloque",
      description: "Cuando termines este bloque, usa Siguiente para pasar a Detalles y después revisar la confirmación final.",
      mode: "wizard",
    },
  ];
}

function GuidedManualEventBridge() {
  const api = useGuidedManualApi();
  const pathname = usePathname();

  useEffect(() => {
    if (!api) return;

    const startCreateMovementGuide = () => {
      const roleBase = getRoleBaseFromPathname(pathname);
      api.startWithSteps(buildCreateMovementGuideSteps(roleBase), 0);
    };

    window.addEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
    return () => window.removeEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
  }, [api, pathname]);

  return null;
}

export default function GuidedManualRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const actionRunner = useCallback(
    (action: GuidedManualAction) => {
      const delayMs = Math.max(0, Number(action.delayMs || 0));

      if (action.type !== "event") return delayMs;

      const execute = () => {
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
    [pathname, router]
  );

  return (
    <GuidedManualProvider steps={[]} actionRunner={actionRunner}>
      <GuidedManualEventBridge />
      {children}
    </GuidedManualProvider>
  );
}
