"use client";

import React, { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GuidedManualProvider,
  useGuidedManualApi,
  type GuidedManualAction,
  type GuidedManualStep,
} from "@/app/Components/GuidedManualAtom";
import { CLIENT_MOVEMENT_GUIDE, CLIENT_MOVEMENT_MOBILE_GUIDE } from "@/app/Components/GuidedManualAtom/ClientMovementGuide.config";

const START_CREATE_MOVEMENT_GUIDE_EVENT = "cosaif:start-create-movement-guide";
const START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT = "cosaif:start-create-movement-torno-guide";
const START_GENERAL_HELP_GUIDE_EVENT = "cosaif:start-general-help-guide";
const GUIDE_CONTEXT_EVENT = "cosaif:guided-context";
const GUIDE_REFRESH_EVENT = "cosaif:guided-refresh";

function getRoleBaseFromPathname(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  if (["administrador", "coordinador", "supervisor", "cliente"].includes(firstSegment)) {
    return `/${firstSegment}`;
  }
  return "/cliente";
}

function detailIsRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
      targetId: "create-movement-step-content",
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

function buildCreateMovementTornoGuideSteps(roleBase: string): GuidedManualStep[] {
  return [
    {
      id: "torno-open-sidebar-movements",
      targetId: "sidebar-menu-movimientos",
      title: "Abre el modulo de movimientos",
      description: "Entra a Movimientos desde el menu lateral para iniciar una solicitud de servicio de torno.",
      mode: "wizard",
      actionOnNext: {
        type: "event",
        eventName: "guide:navigate-role-movements",
        detail: { base: roleBase },
        delayMs: 350,
      },
    },
    {
      id: "torno-open-new-movement-form",
      targetId: "movimientos-new-button",
      title: "Crea un nuevo movimiento",
      description: "Pulsa Nuevo para abrir el formulario donde se capturan los datos del movimiento.",
      mode: "wizard",
      actionOnNext: {
        type: "event",
        eventName: "guide:navigate-create-movement",
        detail: { base: roleBase },
        delayMs: 350,
      },
    },
    {
      id: "torno-fill-base-data",
      targetId: "create-movement-step-content",
      title: "Captura los datos operativos",
      description: "Selecciona empresa y localidad cuando aplique. Enseguida elige Torno como servicio para habilitar sus opciones.",
      mode: "wizard",
    },
    {
      id: "torno-select-service",
      targetId: "create-movement-torno-service",
      title: "Selecciona el servicio Torno",
      description: "Pulsa Torno. Si el trabajo sera para otra fecha, tambien puedes marcar Agendar movimiento y elegir la fecha y hora.",
      mode: "wizard",
    },
    {
      id: "torno-select-mode",
      targetId: "create-movement-torno-selection-mode",
      title: "Elige De via",
      description: "Selecciona De via para registrar el ingreso de la locomotora al torno y habilitar la captura de mediciones.",
      mode: "wizard",
    },
    {
      id: "torno-complete-step-one",
      targetId: "create-movement-step-content",
      title: "Completa los datos del movimiento",
      description: "Indica la locomotora, la via de origen y su seccion. Revisa los campos obligatorios antes de continuar.",
      mode: "wizard",
    },
    {
      id: "torno-continue-step-one",
      targetId: "create-movement-next-step",
      title: "Avanza a la medicion",
      description: "Cuando los datos esten completos, pulsa Siguiente para abrir la captura de ruedas.",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: "[data-guide-id='create-movement-next-step'] button",
        delayMs: 250,
      },
    },
    {
      id: "torno-wheel-count",
      targetId: "torno-wheel-count",
      title: "Selecciona el numero de ruedas",
      description: "Indica cuantas ruedas se mediran. La tabla se ajustara automaticamente al total seleccionado.",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "torno-wheel-count",
      },
    },
    {
      id: "torno-movement-type",
      targetId: "torno-movement-type",
      title: "Define el tipo de movimiento",
      description: "Marca Trabajando o Remolcada. Si eliges Remolcada, completa tambien la direccion de empuje.",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "torno-wheel-count",
      },
    },
    {
      id: "torno-measures-table",
      targetId: "torno-measures-table",
      title: "Captura las medidas",
      description: "Registra las medidas de cada rueda usando entero, numerador and denominador. Completa las posiciones requeridas antes de guardar.",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "torno-wheel-count",
      },
    },
    {
      id: "torno-save-measures",
      targetId: "create-movement-next-step",
      title: "Guarda las mediciones",
      description: "Pulsa Guardar y Continuar para conservar las medidas y pasar a la confirmacion.",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "torno-wheel-count",
      },
      actionOnNext: {
        type: "click",
        selector: "[data-guide-id='create-movement-next-step'] button",
        delayMs: 250,
      },
    },
    {
      id: "torno-fill-details",
      targetId: "create-movement-step-2-standard",
      title: "Completa los detalles",
      description: "Como seleccionaste Para via, en este paso debes completar los detalles operativos standard.",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step-2-standard",
      },
      actionOnNext: {
        type: "click",
        selector: "[data-guide-id='create-movement-next-step'] button",
        delayMs: 250,
      },
    },
    {
      id: "torno-review-summary",
      targetId: "create-movement-step3-summary",
      title: "Revisa el resumen",
      description: "Verifica localidad, origen, locomotora, tipo de movimiento y servicio antes de confirmar.",
      mode: "guide",
    },
    {
      id: "torno-add-comments",
      targetId: "create-movement-step3-comments",
      title: "Agrega observaciones",
      description: "Escribe instrucciones o comentarios adicionales si el movimiento los necesita.",
      mode: "wizard",
    },
    {
      id: "torno-submit-movement",
      targetId: "create-movement-submit",
      title: "Confirma el movimiento",
      description: "Pulsa Confirmar y Continuar al PDF. Espera a que se guarde el movimiento antes de avanzar en esta ayuda.",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: "[data-guide-id='create-movement-submit'] button",
        delayMs: 250,
      },
    },
    {
      id: "torno-review-measures",
      targetId: "create-movement-torno-pdf-summary",
      title: "Revisa las medidas finales",
      description: "Comprueba la unidad, las posiciones y las medidas guardadas. Puedes volver a editar si detectas algun dato incorrecto.",
      mode: "guide",
    },
    {
      id: "torno-generate-pdf",
      targetId: "create-movement-torno-pdf-actions",
      title: "Genera el PDF",
      description: "Pulsa Generar PDF para descargar el reporte de medidas y terminar el proceso.",
      mode: "wizard",
    },
  ];
}

function buildGeneralHelpGuideSteps(guideId: string): GuidedManualStep[] {
  const guides: Record<string, GuidedManualStep[]> = {
    "general-first-steps": [
      {
        id: "general-first-steps-welcome",
        title: "Primeros pasos en CosaifWeb",
        description: "Usa el menu lateral para entrar a los modulos disponibles para tu rol. El dashboard resume lo mas importante y los listados concentran el trabajo operativo.",
        mode: "guide",
        icon: "🧭",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "general-first-steps-navigation",
        title: "Navegacion basica",
        description: "Dashboard es el punto de inicio. Movimientos concentra solicitudes y servicios. Incidentes, usuarios, configuracion y reporteria aparecen solo cuando tu rol tiene permisos.",
        mode: "guide",
      },
      {
        id: "general-first-steps-workflow",
        title: "Forma recomendada de trabajar",
        description: "Primero revisa pendientes, despues abre el detalle de lo que necesitas atender y finalmente confirma cambios solo cuando la informacion sea correcta.",
        mode: "guide",
        tone: "success",
      },
    ],
    "client-dashboard-basics": [
      {
        id: "client-dashboard-basics-start",
        title: "Inicio del cliente",
        description: "El dashboard del cliente muestra sus solicitudes activas. Cuando el servicio incluye torno, Movimiento y Torneado se consultan como entidades separadas.",
        mode: "guide",
        icon: "🏁",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "client-dashboard-basics-status",
        title: "Pendientes y seguimiento",
        description: "Revisa primero los pendientes. Los elementos historicos o terminados pueden estar ocultos o separados segun las reglas operativas activas.",
        mode: "guide",
      },
      {
        id: "client-dashboard-basics-detail",
        title: "Detalle antes de decidir",
        description: "Abre el detalle para validar locomotora, via, localidad, medidas o comentarios antes de solicitar cambios o generar reportes.",
        mode: "guide",
      },
    ],
    "client-create-movement-overview": [
      {
        id: "client-create-movement-overview-start",
        title: "Crear un movimiento",
        description: "El flujo se divide en captura inicial, datos del servicio, comentarios y confirmacion. La vista mobile guiada es la opcion recomendada para capturar sin perder contexto.",
        mode: "guide",
        icon: "➕",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "client-create-movement-overview-service",
        title: "Seleccion del servicio",
        description: "Puedes capturar movimientos ordinarios o seleccionar Torno cuando el servicio requiere mediciones de ruedas. Algunas opciones cambian segun el tipo elegido.",
        mode: "guide",
      },
      {
        id: "client-create-movement-overview-confirm",
        title: "Confirmacion",
        description: "La solicitud se crea al confirmar. Antes de hacerlo, revisa locomotora, vias, localidad, servicio y observaciones.",
        mode: "guide",
        tone: "warning",
      },
    ],
    "client-torno-overview": [
      {
        id: "client-torno-overview-entities",
        title: "Movimiento y Torneado",
        description: "En torno se crean dos entidades relacionadas: el Movimiento logistico y el Torneado. Pueden tener estados diferentes y deben revisarse por separado.",
        mode: "guide",
        icon: "⚙️",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "client-torno-overview-measures",
        title: "Medidas de ruedas",
        description: "Selecciona el numero de ruedas de la locomotora y registra solo las medidas necesarias. El mapa grafico ayuda a ubicar cada rueda con mas claridad.",
        mode: "guide",
      },
      {
        id: "client-torno-overview-schedule",
        title: "Agendado y recuperacion",
        description: "Un torno puede agendarse o recuperarse bajo reglas de negocio. Si aparece un modal de recuperacion, revisa la informacion antes de reutilizarla.",
        mode: "guide",
        tone: "warning",
      },
    ],
    "operations-monitoring-overview": [
      {
        id: "operations-monitoring-overview-start",
        title: "Seguimiento operativo",
        description: "Coordinadores y supervisores revisan rondas, movimientos e incidentes para mantener la operacion en orden.",
        mode: "guide",
        icon: "🚦",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "operations-monitoring-overview-status",
        title: "Estados y prioridades",
        description: "Da prioridad a elementos en proceso, detenidos o con incidentes. Evita modificar un servicio sin validar su estado actual.",
        mode: "guide",
      },
      {
        id: "operations-monitoring-overview-actions",
        title: "Acciones con impacto",
        description: "Iniciar, finalizar, cancelar o editar una ronda puede afectar la operacion. Confirma siempre localidad, locomotora y servicio antes de actuar.",
        mode: "guide",
        tone: "warning",
      },
    ],
    "incidents-overview": [
      {
        id: "incidents-overview-start",
        title: "Incidentes",
        description: "Los incidentes documentan problemas operativos. Su seguimiento ayuda a decidir si un movimiento continua, se pausa o se cancela.",
        mode: "guide",
        icon: "⚠️",
        tone: "warning",
        hidePrevious: true,
      },
      {
        id: "incidents-overview-rule",
        title: "Reglas automaticas",
        description: "Algunas reglas pueden cancelar un movimiento despues de acumular incidentes. Si el movimiento incluye torno, tambien puede afectar el torneado relacionado.",
        mode: "guide",
      },
      {
        id: "incidents-overview-history",
        title: "Historial y evidencia",
        description: "Revisa comentarios, fechas y responsables antes de cerrar una incidencia o tomar decisiones operativas.",
        mode: "guide",
      },
    ],
    "admin-users-overview": [
      {
        id: "admin-users-overview-start",
        title: "Usuarios y permisos",
        description: "Los administradores gestionan usuarios, roles, empresas y permisos. Cada rol ve solo los modulos necesarios para su operacion.",
        mode: "guide",
        icon: "🛡️",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "admin-users-overview-passwords",
        title: "Cambios sensibles",
        description: "Cambios como contrasenas requieren validacion del usuario autorizado. Evita compartir credenciales o datos sensibles en observaciones.",
        mode: "guide",
        tone: "warning",
      },
      {
        id: "admin-users-overview-review",
        title: "Revision periodica",
        description: "Revisa usuarios activos, empresas asignadas y permisos para mantener el acceso alineado con la operacion real.",
        mode: "guide",
      },
    ],
    "reports-overview": [
      {
        id: "reports-overview-start",
        title: "Reporteria",
        description: "La reporteria permite consultar resultados, historicos y documentos operativos como PDFs de torno o reportes de movimientos.",
        mode: "guide",
        icon: "📊",
        tone: "info",
        hidePrevious: true,
      },
      {
        id: "reports-overview-filters",
        title: "Filtros",
        description: "Usa filtros de fecha, localidad, empresa o servicio cuando esten disponibles. Un filtro incorrecto puede ocultar informacion esperada.",
        mode: "guide",
      },
      {
        id: "reports-overview-export",
        title: "Exportacion",
        description: "Antes de descargar o compartir un reporte, valida que corresponda al periodo, rol y servicio requerido.",
        mode: "guide",
      },
    ],
  };

  return guides[guideId] ?? guides["general-first-steps"];
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

    const startCreateMovementTornoGuide = () => {
      const roleBase = getRoleBaseFromPathname(pathname);
      api.startWithSteps(buildCreateMovementTornoGuideSteps(roleBase), 0);
    };

    const startGeneralHelpGuide = (event: Event) => {
      const detail = event instanceof CustomEvent && detailIsRecord(event.detail) ? event.detail : null;
      const guideId = typeof detail?.guideId === "string" ? detail.guideId : "general-first-steps";
      api.startWithSteps(buildGeneralHelpGuideSteps(guideId), 0);
    };

    window.addEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
    window.addEventListener(START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT, startCreateMovementTornoGuide);
    window.addEventListener(START_GENERAL_HELP_GUIDE_EVENT, startGeneralHelpGuide);
    return () => {
      window.removeEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
      window.removeEventListener(START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT, startCreateMovementTornoGuide);
      window.removeEventListener(START_GENERAL_HELP_GUIDE_EVENT, startGeneralHelpGuide);
    };
  }, [api, pathname]);

  useEffect(() => {
    if (!api) return;

    const syncContext = (event: Event) => {
      const detail = event instanceof CustomEvent && detailIsRecord(event.detail) ? event.detail : null;
      if (!detail) return;
      api.mergeContext(detail);
    };

    const refreshGuideLayout = () => api.refreshLayout();

    window.addEventListener(GUIDE_CONTEXT_EVENT, syncContext);
    window.addEventListener(GUIDE_REFRESH_EVENT, refreshGuideLayout);
    return () => {
      window.removeEventListener(GUIDE_CONTEXT_EVENT, syncContext);
      window.removeEventListener(GUIDE_REFRESH_EVENT, refreshGuideLayout);
    };
  }, [api]);

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
          return;
        }

        if (action.eventName) {
          window.dispatchEvent(new CustomEvent(action.eventName, { detail: action.detail || {} }));
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
    <GuidedManualProvider steps={[]} manuals={[CLIENT_MOVEMENT_GUIDE, CLIENT_MOVEMENT_MOBILE_GUIDE]} actionRunner={actionRunner}>
      <GuidedManualEventBridge />
      {children}
    </GuidedManualProvider>
  );
}
