import { defineGuidedManual } from ".";

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
