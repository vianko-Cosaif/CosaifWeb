import { defineGuidedManual } from "./GuidedManualAtom.core";

export const CLIENT_MOVEMENT_GUIDE_ID = "client-create-movement";

export const CLIENT_MOVEMENT_GUIDE = defineGuidedManual({
  id: CLIENT_MOVEMENT_GUIDE_ID,
  title: "Crear un movimiento",
  disableAppElements: ['[data-guide-action="create-movement-next"]'],
  steps: [
    {
      id: "open-movements",
      title: "Abre Movimientos",
      description: "Selecciona Movimientos en el menu lateral para consultar y crear solicitudes.",
      targetId: "client-nav-movements",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-id="client-nav-movements"] button',
      },
    },
    {
      id: "new-movement",
      title: "Crea un movimiento",
      description: "Pulsa Nuevo para iniciar el registro de una solicitud.",
      targetId: "client-new-movement",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-id="client-new-movement"] button',
      },
    },
    {
      id: "movement-configuration",
      title: "Configura el movimiento",
      description: "Aqui defines empresa, localidad, servicio, locomotora, via y opciones operativas. Si eliges Torno, el movimiento puede llevar medidas de ruedas y tambien puede calendarizarse para otra fecha.",
      targetId: "create-movement-step-1",
      mode: "wizard",
    },
    {
      id: "torno-schedule",
      title: "Calendariza un Torno",
      description: "Cuando el servicio es Torno puedes marcar Agendar movimiento y elegir fecha y hora. La solicitud queda guardada como agendada; al llegar el momento, si se reactiva dentro de la ventana permitida, recupera las medidas capturadas y se coloca en ronda.",
      targetId: "create-movement-torno-schedule",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-torno-schedule",
      },
    },
    {
      id: "movement-configuration-continue",
      title: "Continua con la captura",
      description: "Cuando la configuracion sea correcta, avanza. Si seleccionaste Torno pasaras a registrar medidas; para otros servicios continuaras con los detalles operativos.",
      targetId: "create-movement-step-1",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
      },
      actionOnPrevious: {
        type: "click",
        selector: '[data-guide-action="create-movement-prev"]',
      },
    },
    {
      id: "torno-measures",
      title: "Registra medidas de Torno",
      description: "Registra las medidas solicitadas para cada rueda. Puedes usar las herramientas de copiado y pegado antes de continuar.",
      targetId: "create-movement-step-2-torno",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step-2-torno",
      },
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
      },
      actionOnPrevious: {
        type: "click",
        selector: '[data-guide-action="create-movement-prev"]',
      },
    },
    {
      id: "movement-details",
      title: "Completa detalles",
      description: "Completa los datos operativos adicionales del movimiento antes de continuar.",
      targetId: "create-movement-step-2-standard",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step-2-standard",
      },
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
      },
      actionOnPrevious: {
        type: "click",
        selector: '[data-guide-action="create-movement-prev"]',
      },
    },
    {
      id: "movement-comments",
      title: "Confirma antes de crear",
      description: "Revisa el resumen y agrega instrucciones. Al cliquear Continuar o Confirmar se creara un nuevo movimiento con la informacion capturada; si aun no estas seguro, corrige antes de avanzar.",
      targetId: "create-movement-step-3",
      mode: "wizard",
      tone: "critical",
      icon: "⚠️",
      customTitleSize: 26,
      customTitleColor: "#fca5a5",
      customDescriptionSize: 18,
      customDescriptionColor: "#fecaca",
      disableAppElements: ['[data-guide-action="create-movement-submit"]'],
      confirmation: {
        title: "¡ALERTA CRÍTICA!",
        description: "Si desea continuar se creará el movimiento y se pondrá en Ronda el movimiento de forma definitiva.",
        confirmText: "Sí, crear movimiento",
        cancelText: "Cancelar y revisar",
        tone: "critical",
        icon: "🚨",
        confirmDelaySeconds: 5,
        customTitleSize: 28,
        customDescriptionSize: 18,
        customTitleColor: "#ef4444",
        customDescriptionColor: "#fee2e2",
      },
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-submit"]',
      },
      actionOnPrevious: {
        type: "click",
        selector: '[data-guide-action="create-movement-prev"]',
      },
    },
    {
      id: "movement-confirmation",
      title: "PDF y cierre",
      description: "El movimiento ya fue creado. En esta pantalla puedes generar el PDF de medidas para conservar el respaldo, o finalizar la guia y regresar al listado.",
      targetId: "create-movement-step-4",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step-4",
      },
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-exit"]',
      },
    },
    {
      id: "movement-created",
      title: "Movimiento registrado",
      description: "El listado se actualiza y aqui debe aparecer el movimiento que acabas de crear.",
      targetId: "client-movements-list",
      mode: "guide",
    },
  ],
});

export const CLIENT_MOVEMENT_MOBILE_GUIDE_ID = "client-create-movement-mobile";

export const CLIENT_MOVEMENT_MOBILE_GUIDE = defineGuidedManual({
  id: CLIENT_MOVEMENT_MOBILE_GUIDE_ID,
  title: "Crear un movimiento (Flujo mobile)",
  steps: [
    {
      id: "mobile-open-movements",
      title: "Abre Movimientos",
      description: "Selecciona Movimientos en el menu lateral para consultar y crear solicitudes.",
      targetId: "sidebar-menu-movimientos",
      mode: "wizard",
      actionOnNext: {
        type: "event",
        eventName: "guide:navigate-role-movements",
        delayMs: 350,
      },
    },
    {
      id: "mobile-new-movement",
      title: "Crea un movimiento",
      description: "Pulsa Nuevo para iniciar el registro de una solicitud.",
      targetId: "movimientos-new-button",
      mode: "wizard",
      actionOnNext: {
        type: "event",
        eventName: "guide:navigate-create-movement",
        delayMs: 350,
      },
    },
    {
      id: "mobile-understand-mobile-wizard",
      targetId: "create-movement-stepper",
      title: "Flujo guiado tipo Mobile",
      description: "En este modo, el formulario esta dividido en pequeñas pantallas consecutivas para mayor comodidad en dispositivos moviles.",
      mode: "guide",
    },
    {
      id: "mobile-step-one-company",
      title: "Empresa y Localidad",
      description: "Selecciona la empresa y localidad para este movimiento.",
      targetId: "create-movement-step-1",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
        delayMs: 250,
      },
    },
    {
      id: "mobile-step-one-service",
      title: "Selecciona el Servicio",
      description: "Elige el servicio (por ejemplo, Torno) y define las opciones operativas.",
      targetId: "create-movement-torno-service",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
        delayMs: 250,
      },
    },
    {
      id: "mobile-step-one-locomotive",
      title: "Locomotora",
      description: "Escribe el numero exacto de la locomotora.",
      targetId: "create-movement-locomotive",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
        delayMs: 250,
      },
    },
    {
      id: "mobile-step-one-route",
      title: "Vias y Secciones",
      description: "Indica la via y seccion de origen para este movimiento.",
      targetId: "create-movement-route",
      mode: "wizard",
      actionOnNext: {
        type: "click",
        selector: '[data-guide-action="create-movement-next"]',
        delayMs: 250,
      },
    },
    {
      id: "mobile-step-two-torno",
      title: "Mediciones de Torno",
      description: "En este modo movil, registra las medidas de ruedas.",
      targetId: "create-movement-step-2-torno",
      mode: "guide",
      when: {
        type: "target",
        targetId: "create-movement-step-2-torno",
      },
    },
    {
      id: "mobile-torno-movement-type",
      title: "Define el tipo de movimiento",
      description: "Selecciona si la locomotora viene trabajando (MD) o remolcada.",
      targetId: "torno-movement-type",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "torno-movement-type",
      },
    },
    {
      id: "mobile-torno-wheel-count",
      title: "Selecciona el número de ruedas",
      description: "Elige la cantidad de ruedas que vas a medir (ej. 8).",
      targetId: "torno-wheel-count",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "torno-wheel-count",
      },
    },
    {
      id: "mobile-torno-wheel-map",
      title: "Captura de medidas",
      description: "Toca una de las ruedas en la locomotora para abrir el capturador e ingresar sus medidas.",
      targetId: "create-movement-step-2-torno",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step-2-torno",
      },
    },
    {
      id: "mobile-step-two-standard",
      title: "Detalles del movimiento",
      description: "Completa los detalles operativos estandar para este movimiento.",
      targetId: "create-movement-step-2-standard",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step-2-standard",
      },
    },
    {
      id: "mobile-step-three-summary",
      title: "Revisa el resumen",
      description: "Verifica que todos los datos sean correctos antes de enviar.",
      targetId: "create-movement-step3-summary",
      mode: "guide",
      when: {
        type: "target",
        targetId: "create-movement-step3-summary",
      },
    },
    {
      id: "mobile-step-three-comments",
      title: "Comentarios",
      description: "Escribe observaciones si es necesario.",
      targetId: "create-movement-step3-comments",
      mode: "wizard",
      when: {
        type: "target",
        targetId: "create-movement-step3-comments",
      },
    },
    {
      id: "mobile-submit-movement",
      title: "Confirma el movimiento",
      description: "Pulsa el boton de enviar para finalizar el registro.",
      targetId: "create-movement-submit",
      mode: "wizard",
    },
  ],
});
