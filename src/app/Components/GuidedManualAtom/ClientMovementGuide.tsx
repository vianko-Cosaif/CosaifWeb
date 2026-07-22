"use client";

import { ReactNode, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import {
  GuidedManualProvider,
  useGuidedManualApi,
  GuidedManualAction,
  GuidedManualStep,
} from ".";
import {
  CLIENT_MOVEMENT_GUIDE,
  CLIENT_MOVEMENT_GUIDE_ID,
  CLIENT_MOVEMENT_MOBILE_GUIDE,
  CLIENT_MOVEMENT_MOBILE_GUIDE_ID,
} from "./ClientMovementGuide.config";

const START_CREATE_MOVEMENT_GUIDE_EVENT = "cosaif:start-create-movement-guide";
const START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT = "cosaif:start-create-movement-torno-guide";
const START_GENERAL_HELP_GUIDE_EVENT = "cosaif:start-general-help-guide";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function navigateStep(eventId: string, href: string, delayMs = 350): GuidedManualStep["actionOnNext"] {
  return {
    type: "event",
    eventName: "guide:navigate-path",
    detail: { href, eventId },
    delayMs,
  };
}

function buildGeneralHelpGuideSteps(guideId: string, roleBase: string): GuidedManualStep[] {
  const dashboardHref = roleBase || "/cliente";
  const movementsHref = `${roleBase}/movimientos`;
  const createMovementHref = "/movimientos/crear";
  const tornoHref = `${roleBase}/torno`;
  const incidentsHref = `${roleBase}/incidentes`;
  const usersHref = `${roleBase}/usuarios`;
  const reportsHref = `${roleBase}/reporteria`;

  const guides: Record<string, GuidedManualStep[]> = {
    "general-first-steps": [
      {
        id: "general-first-steps-welcome",
        title: "Primeros pasos en CosaifWeb",
        description: "Este recorrido te muestra las vistas principales sin pedirte capturar ni confirmar informacion. Avanza para ver donde se concentra cada parte del trabajo.",
        mode: "guide",
        icon: "🧭",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("general-dashboard", dashboardHref),
      },
      {
        id: "general-first-steps-navigation",
        targetId: "client-nav-movements",
        title: "Navegacion basica",
        description: "El menu lateral muestra los modulos permitidos para tu rol. Movimientos es uno de los accesos principales para consultar solicitudes y servicios.",
        mode: "guide",
        actionOnNext: navigateStep("general-movements", movementsHref),
      },
      {
        id: "general-first-steps-workflow",
        targetId: "client-movements-list",
        title: "Forma recomendada de trabajar",
        description: "En los listados revisa pendientes, estados y detalles antes de actuar. Esta guia solo te muestra la pantalla; no inicia ni completa ningun proceso.",
        mode: "guide",
        tone: "success",
      },
    ],
    "client-dashboard-basics": [
      {
        id: "client-dashboard-basics-start",
        title: "Inicio del cliente",
        description: "Primero veremos la pantalla de inicio del cliente y luego el listado donde se consultan movimientos y torneados. No tendras que editar ni capturar datos.",
        mode: "guide",
        icon: "🏁",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("client-dashboard", dashboardHref),
      },
      {
        id: "client-dashboard-basics-status",
        targetId: "client-nav-movements",
        title: "Pendientes y seguimiento",
        description: "Desde el menu puedes ir al modulo de movimientos. Ahi se consultan pendientes y, segun reglas activas, historicos o terminados.",
        mode: "guide",
        actionOnNext: navigateStep("client-movements", movementsHref),
      },
      {
        id: "client-dashboard-basics-detail",
        targetId: "client-movements-list",
        title: "Detalle antes de decidir",
        description: "Abre el detalle para validar locomotora, via, localidad, medidas o comentarios antes de solicitar cambios o generar reportes.",
        mode: "guide",
      },
    ],
    "client-create-movement-overview": [
      {
        id: "client-create-movement-overview-start",
        title: "Crear un movimiento",
        description: "Este tutorial solo muestra las etapas del formulario. No tendras que llenar campos ni crear la solicitud.",
        mode: "guide",
        icon: "➕",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("create-movement-view", createMovementHref),
      },
      {
        id: "client-create-movement-overview-service",
        targetId: "create-movement-stepper",
        title: "Estructura por etapas",
        description: "La pantalla esta dividida en pasos: configuracion inicial, detalles o medidas, comentarios y confirmacion. La barra indica donde estas.",
        mode: "guide",
      },
      {
        id: "client-create-movement-overview-fields",
        targetId: "create-movement-step-1",
        title: "Seleccion del servicio",
        description: "Puedes capturar movimientos ordinarios o seleccionar Torno cuando el servicio requiere mediciones de ruedas. Algunas opciones cambian segun el tipo elegido.",
        mode: "guide",
      },
      {
        id: "client-create-movement-overview-confirm",
        targetId: "create-movement-next-step",
        title: "Avance controlado",
        description: "Este boton sirve para avanzar cuando los datos esten listos. En este tutorial no se presionara ni se completara la captura.",
        mode: "guide",
        tone: "warning",
      },
    ],
    "client-torno-overview": [
      {
        id: "client-torno-overview-entities",
        title: "Movimiento y Torneado",
        description: "Veremos donde se inicia un movimiento tipo torno y que significa que Movimiento y Torneado sean entidades relacionadas, pero independientes.",
        mode: "guide",
        icon: "⚙️",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("torno-create-view", createMovementHref),
      },
      {
        id: "client-torno-overview-measures",
        targetId: "create-movement-torno-service",
        title: "Servicio Torno",
        description: "Al seleccionar Torno se habilitan reglas y secciones propias de medicion de ruedas. Esta guia solo explica la zona; no selecciona el servicio.",
        mode: "guide",
      },
      {
        id: "client-torno-overview-schedule",
        targetId: "create-movement-torno-schedule",
        title: "Agendado y recuperacion",
        description: "Si se agenda o se recupera una solicitud, el sistema puede proponer datos previos. Siempre revisa el modal antes de reutilizar informacion.",
        mode: "guide",
        tone: "warning",
        actionOnNext: navigateStep("torno-history-view", tornoHref),
      },
      {
        id: "client-torno-overview-history",
        selector: "#main",
        title: "Medidas de ruedas",
        description: "En la vista de torno se consulta el seguimiento o historial relacionado. Movimiento y Torneado pueden tener estados diferentes.",
        mode: "guide",
      },
    ],
    "operations-monitoring-overview": [
      {
        id: "operations-monitoring-overview-start",
        title: "Seguimiento operativo",
        description: "Este recorrido muestra las vistas de seguimiento para coordinadores y supervisores. No inicia, finaliza ni cancela servicios.",
        mode: "guide",
        icon: "🚦",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("operations-movements", movementsHref),
      },
      {
        id: "operations-monitoring-overview-status",
        targetId: "client-movements-list",
        title: "Estados y prioridades",
        description: "Da prioridad a elementos en proceso, detenidos o con incidentes. Evita modificar un servicio sin validar su estado actual.",
        mode: "guide",
        actionOnNext: navigateStep("operations-torno", tornoHref),
      },
      {
        id: "operations-monitoring-overview-actions",
        selector: "#main",
        title: "Acciones con impacto",
        description: "La vista de torno permite consultar servicios relacionados. Las acciones operativas deben ejecutarse solo despues de validar localidad, locomotora y estado.",
        mode: "guide",
        tone: "warning",
      },
    ],
    "incidents-overview": [
      {
        id: "incidents-overview-start",
        title: "Incidentes",
        description: "Veremos la vista de incidentes como consulta general. No se creara ni cerrara ningun incidente durante este tutorial.",
        mode: "guide",
        icon: "⚠️",
        tone: "warning",
        hidePrevious: true,
        actionOnNext: navigateStep("incidents-view", incidentsHref),
      },
      {
        id: "incidents-overview-rule",
        selector: "#main",
        title: "Reglas automaticas",
        description: "Algunas reglas pueden cancelar un movimiento despues de acumular incidentes. Si el movimiento incluye torno, tambien puede afectar el torneado relacionado.",
        mode: "guide",
      },
      {
        id: "incidents-overview-history",
        selector: "#main",
        title: "Historial y evidencia",
        description: "Revisa comentarios, fechas y responsables antes de cerrar una incidencia o tomar decisiones operativas.",
        mode: "guide",
      },
    ],
    "admin-users-overview": [
      {
        id: "admin-users-overview-start",
        title: "Usuarios y permisos",
        description: "Este recorrido abre la vista de usuarios para explicar roles y permisos. No modificara cuentas ni contrasenas.",
        mode: "guide",
        icon: "🛡️",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("admin-users-view", usersHref),
      },
      {
        id: "admin-users-overview-passwords",
        selector: "#main",
        title: "Cambios sensibles",
        description: "Cambios como contrasenas requieren validacion del usuario autorizado. Evita compartir credenciales o datos sensibles en observaciones.",
        mode: "guide",
        tone: "warning",
      },
      {
        id: "admin-users-overview-review",
        selector: "#main",
        title: "Revision periodica",
        description: "Revisa usuarios activos, empresas asignadas y permisos para mantener el acceso alineado con la operacion real.",
        mode: "guide",
      },
    ],
    "reports-overview": [
      {
        id: "reports-overview-start",
        title: "Reporteria",
        description: "Veremos la vista de reporteria y sus puntos generales. No se aplicaran filtros ni se descargaran archivos automaticamente.",
        mode: "guide",
        icon: "📊",
        tone: "info",
        hidePrevious: true,
        actionOnNext: navigateStep("reports-view", reportsHref),
      },
      {
        id: "reports-overview-filters",
        selector: "#main",
        title: "Filtros",
        description: "Usa filtros de fecha, localidad, empresa o servicio cuando esten disponibles. Un filtro incorrecto puede ocultar informacion esperada.",
        mode: "guide",
      },
      {
        id: "reports-overview-export",
        selector: "#main",
        title: "Exportacion",
        description: "Antes de descargar o compartir un reporte, valida que corresponda al periodo, rol y servicio requerido.",
        mode: "guide",
      },
    ],
  };

  return guides[guideId] ?? guides["general-first-steps"];
}

function GuidedHelpEventBridge() {
  const api = useGuidedManualApi();
  const pathname = usePathname();

  useEffect(() => {
    if (!api) return;

    const startGeneralHelpGuide = (event: Event) => {
      const detail = event instanceof CustomEvent && isRecord(event.detail) ? event.detail : null;
      const guideId = typeof detail?.guideId === "string" ? detail.guideId : "general-first-steps";
      api.startWithSteps(buildGeneralHelpGuideSteps(guideId, getRoleBaseFromPathname(pathname)), 0);
    };

    const startCreateMovementGuide = () => {
      api.startManual(CLIENT_MOVEMENT_GUIDE_ID);
    };

    const startCreateMovementTornoGuide = () => {
      api.startManual(CLIENT_MOVEMENT_MOBILE_GUIDE_ID);
    };

    window.addEventListener(START_GENERAL_HELP_GUIDE_EVENT, startGeneralHelpGuide);
    window.addEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
    window.addEventListener(START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT, startCreateMovementTornoGuide);
    return () => {
      window.removeEventListener(START_GENERAL_HELP_GUIDE_EVENT, startGeneralHelpGuide);
      window.removeEventListener(START_CREATE_MOVEMENT_GUIDE_EVENT, startCreateMovementGuide);
      window.removeEventListener(START_CREATE_MOVEMENT_TORNO_GUIDE_EVENT, startCreateMovementTornoGuide);
    };
  }, [api, pathname]);

  return null;
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
          window.location.assign("/movimientos/crear");
          return;
        }

        if (action.eventName === "guide:navigate-path") {
          const href = typeof action.detail?.href === "string" ? action.detail.href.trim() : "";
          if (href) router.push(href);
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
      <GuidedHelpEventBridge />
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
