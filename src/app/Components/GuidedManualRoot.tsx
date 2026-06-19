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
      id: "continue-create-movement-step-one",
      targetId: "create-movement-next-step",
      title: "Pasa al paso 2",
      description: "Cuando completes los datos iniciales, usa este botón para avanzar al bloque de detalles del movimiento.",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: "[data-guide-id='create-movement-next-step'] button",
        delayMs: 250,
      },
    },
    {
      id: "fill-create-movement-step-two-general",
      targetId: "create-movement-step2-general",
      title: "Completa el paso 2",
      description: "Aquí defines los detalles del movimiento. Si eliges Remolcada, también deberás seleccionar su dirección.",
      mode: "wizard",
    },
    {
      id: "continue-create-movement-step-two",
      targetId: "create-movement-next-step",
      title: "Pasa al paso 3",
      description: "Cuando termines los detalles, avanza para revisar el resumen final antes de confirmar el movimiento.",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: "[data-guide-id='create-movement-next-step'] button",
        delayMs: 250,
      },
    },
    {
      id: "review-create-movement-step-three-summary",
      targetId: "create-movement-step3-summary",
      title: "Revisa el resumen",
      description: "Aquí verificas que la localidad, vías, locomotora, tipo y servicio coincidan con lo que capturaste.",
      mode: "guide",
    },
    {
      id: "fill-create-movement-step-three-comments",
      targetId: "create-movement-step3-comments",
      title: "Agrega comentarios si hace falta",
      description: "En este espacio puedes dejar instrucciones u observaciones para complementar la solicitud.",
      mode: "wizard",
    },
    {
      id: "submit-create-movement",
      targetId: "create-movement-submit",
      title: "Confirma el movimiento",
      description: "Cuando todo esté correcto, usa este botón para enviar la solicitud y terminar el proceso.",
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
    [pathname, router]
  );

  return (
    <GuidedManualProvider steps={[]} actionRunner={actionRunner}>
      <GuidedManualEventBridge />
      {children}
    </GuidedManualProvider>
  );
}
