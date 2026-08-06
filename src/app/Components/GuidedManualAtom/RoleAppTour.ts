import type { GuidedManualStep } from ".";
import type { TrainingRole } from "./trainingRoles";

type Routes = {
  base: string;
  dashboard: string;
  movements: string;
  torno: string;
  incidents: string;
  users: string;
  reports: string;
  config: string;
};

function routesFor(role: TrainingRole): Routes {
  const clientWithTorreonAccess = role === "CLIENTE_ADMIN" || role === "CLIENTE_COOR";
  const base = role === "ADMINISTRADOR"
    ? "/administrador"
    : role === "COORDINADOR"
      ? "/coordinador"
      : role === "SUPERVISOR"
        ? "/supervisor"
        : role === "COMERCIAL"
          ? "/comercial"
          : role === "ARRASTRE_TORREON"
            ? "/cliente/torreon"
            : "/cliente";
  return {
    base,
    dashboard: role === "COMERCIAL" ? "/comercial/reporte-general" : base,
    movements: `${base}/movimientos`,
    torno: `${base}/torno`,
    incidents: role === "ARRASTRE_TORREON" || clientWithTorreonAccess
      ? "/cliente/torreon/incidentes"
      : `${base}/incidentes`,
    users: `${base}/usuarios`,
    reports: `${base}/reporteria`,
    config: `${base}/configuracion`,
  };
}

function clickStep(
  id: string,
  targetId: string,
  title: string,
  description: string,
  tone: GuidedManualStep["tone"] = "info",
): GuidedManualStep {
  const isSidebarTarget = targetId.startsWith("sidebar-menu-");
  return {
    id,
    ...(isSidebarTarget
      ? { selector: `[data-guide-id='${targetId}']` }
      : { targetId }),
    title,
    description,
    mode: "wizard",
    tone,
    advanceOnTargetClick: true,
  };
}

function clickSelectorStep(
  id: string,
  selector: string,
  title: string,
  description: string,
  tone: GuidedManualStep["tone"] = "info",
): GuidedManualStep {
  return {
    id,
    selector,
    title,
    description,
    mode: "wizard",
    tone,
    advanceOnTargetClick: true,
  };
}

function explainStep(
  id: string,
  title: string,
  description: string,
  targetId?: string,
  selector = "#main",
  tone: GuidedManualStep["tone"] = "default",
): GuidedManualStep {
  return {
    id,
    ...(targetId ? { targetId } : { selector }),
    title,
    description,
    mode: "guide",
    tone,
  };
}

function practiceStep(
  id: string,
  title: string,
  description: string,
  targetId?: string,
  selector = "#main",
  tone: GuidedManualStep["tone"] = "info",
): GuidedManualStep {
  return {
    ...explainStep(id, title, description, targetId, selector, tone),
    mode: "wizard",
  };
}

function finishStep(roleLabel: string): GuidedManualStep {
  return {
    id: "role-app-tour-finish",
    selector: "#main",
    title: "Capacitación terminada",
    description: `Qué ves: completaste el paso a paso de ${roleLabel}.\nHaz esto: pulsa Terminar y vuelve a trabajar con calma.\nQué pasará: se borrarán los ejemplos SIM y no quedará ningún cambio real.`,
    mode: "guide",
    tone: "success",
    icon: "✅",
    actionOnNext: {
      type: "event",
      eventName: "guide:finish-role-app-tour",
      detail: { roleLabel },
    },
  };
}

/**
 * El proveedor no ejecuta actionOnNext cuando el paso actual ya es el ultimo.
 * Este paso no llega a mostrarse: mantiene finishStep como penultimo para que
 * su evento cierre el recorrido y limpie toda la simulacion.
 */
function safeCloseStep(): GuidedManualStep {
  return {
    id: "role-app-tour-exam-handoff",
    selector: "#main",
    title: "Cerrando la práctica",
    description: "Los ejemplos SIM se están limpiando.",
    mode: "guide",
    tone: "success",
  };
}

export type RoleAppTourChapterId =
  | "dashboard"
  | "movements"
  | "create-edit"
  | "rounds"
  | "incidents"
  | "torno"
  | "access"
  | "commercial"
  | "arrastre";

export type RoleAppTourChapter = {
  id: RoleAppTourChapterId;
  title: string;
  steps: GuidedManualStep[];
};

const CREATE_NEXT_BUTTON = "[data-guide-id='create-movement-next-step'] button";
const EDIT_NEXT_BUTTON = "[data-guide-id='edit-movement-next-step'] button";

function noviceCopy(what: string, action: string, result: string) {
  return `Qué ves: ${what}.\nHaz esto: ${action}.\nQué pasará: ${result}.`;
}

function isVisibleMenuTarget(targetId: string) {
  if (typeof window === "undefined") return false;
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-guide-id='${targetId}']`))
    .some((node) => {
      const rect = node.getBoundingClientRect();
      const styles = window.getComputedStyle(node);
      return styles.display !== "none"
        && styles.visibility !== "hidden"
        && Number(styles.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < window.innerHeight
        && rect.left < window.innerWidth;
    });
}

function withMobileMenuOpeners(
  steps: GuidedManualStep[],
  openBeforeFirstMenu = false,
): GuidedManualStep[] {
  if (typeof window === "undefined" || window.innerWidth >= 768) return steps;
  let menuStepSeen = openBeforeFirstMenu;
  return steps.flatMap((step) => {
    const menuTargetId = step.selector?.match(/data-guide-id=['"](sidebar-menu-[^'"]+)['"]/)?.[1];
    if (!menuTargetId) return [step];
    const needsMenuOpener = menuStepSeen || !isVisibleMenuTarget(menuTargetId);
    menuStepSeen = true;
    if (!needsMenuOpener) return [step];
    return [
      {
        id: `${step.id}-open-mobile-menu`,
        chapter: step.chapter,
        selector: "[data-guide-id='sidebar-mobile-more']",
        title: "Abre el menú de módulos",
        description: noviceCopy(
          "la barra inferior muestra accesos rápidos y Más abre el resto de tu menú",
          "pulsa Más; después te indicaremos exactamente qué módulo abrir",
          "sólo se abrirá el menú y no se modificará ningún dato",
        ),
        mode: "wizard",
        tone: "info",
        advanceOnTargetClick: true,
      },
      step,
    ];
  });
}

function validatedStep(
  id: string,
  title: string,
  description: string,
  targetId: string,
  nextButtonSelector: string,
  disabled: string[] = [],
): GuidedManualStep {
  return {
    ...practiceStep(id, title, description, targetId),
    actionOnNext: { type: "click", selector: nextButtonSelector },
    disableAppElements: disabled,
  };
}

function withCondition(
  steps: GuidedManualStep[],
  condition: NonNullable<GuidedManualStep["when"]>,
) {
  return steps.map((step) => ({
    ...step,
    when: step.when
      ? { type: "all" as const, conditions: [condition, step.when] }
      : condition,
  }));
}

function operationalRoleLabel(role: TrainingRole) {
  if (role === "COORDINADOR") return "Coordinación";
  if (role === "SUPERVISOR") return "Supervisión";
  if (role === "ADMINISTRADOR") return "Administración";
  if (role === "CLIENTE_ADMIN") return "Cliente administrador";
  if (role === "CLIENTE_COOR") return "Cliente coordinador";
  return "Cliente";
}

function buildDashboardChapter(role: TrainingRole): RoleAppTourChapter {
  const isClient = role.startsWith("CLIENTE");
  const hasRounds = role !== "ADMINISTRADOR";
  return {
    id: "dashboard",
    title: "1. Operación (Dashboard)",
    steps: [
      clickStep(
        "tour-open-dashboard",
        "sidebar-menu-dashboard",
        "1. Operación · Pulsa el botón que brilla",
        noviceCopy(
          "el menú real de tu cuenta",
          "pulsa Operación; durante la capacitación sólo funcionará el control iluminado",
          "abrirás el tablero sin cambiar ningún dato; si cierras la guía, la práctica termina",
        ),
      ),
      explainStep(
        "tour-dashboard-board",
        "1. Operación · Identifica el trabajo actual",
        noviceCopy(
          hasRounds
            ? "la tarjeta actual; la cola de la derecha contiene lo que sigue"
            : "el resumen de la operación que tu rol puede consultar",
          isClient
            ? "lee locomotora, empresa, origen, destino y posición; puedes ver la localidad completa, pero sólo cambiar lo de tu empresa"
            : "lee locomotora, empresa, origen, destino, prioridad y estado antes de tomar una decisión",
          "sólo estás consultando; nada cambia en la ronda",
        ),
        undefined,
        hasRounds ? "[data-guide-id='dashboard-current-movement']" : "#main",
      ),
    ],
  };
}

function buildMovementsChapter(): RoleAppTourChapter {
  return {
    id: "movements",
    title: "2. Seguimiento (Movimientos)",
    steps: [
      clickStep(
        "tour-open-movements",
        "sidebar-menu-movimientos",
        "2. Seguimiento · Abre los movimientos",
        noviceCopy(
          "Operación muestra el orden; Seguimiento muestra la solicitud completa",
          "pulsa Seguimiento",
          "verás Activos e Historial; abrirlos no modifica solicitudes",
        ),
      ),
      clickSelectorStep(
        "tour-open-active-sim-movement",
        "[data-training-movement-id='910000204']",
        "2. Movimientos · Abre el ejemplo activo",
        noviceCopy(
          "Activos contiene solicitudes que todavía requieren seguimiento",
          "pulsa la fila SIM-MOV-204 que brilla",
          "se abrirá su detalle ficticio; ningún movimiento real cambia",
        ),
      ),
      explainStep(
        "tour-read-active-sim-movement",
        "2. Movimientos · Lee la información expandida",
        noviceCopy(
          "el panel expandido reúne folio, empresa, localidad, ruta, responsables, prioridad, instrucciones y tiempos del movimiento activo",
          "léelo de arriba hacia abajo y pulsa Continuar solamente cuando identifiques locomotora, origen, destino y estado",
          "el detalle permanecerá abierto; todavía no cambiarás de movimiento ni ejecutarás una acción",
        ),
        undefined,
        "[data-training-movement-details='910000204']",
      ),
      clickSelectorStep(
        "tour-open-history-tab",
        "[data-movements-scope='pasados']",
        "2. Movimientos · Comprueba antes de buscar",
        noviceCopy(
          "el detalle abierto muestra folio, locomotora, ruta, estado, responsables y tiempos",
          "verifica esos datos y pulsa Historial",
          "cambiará la lista, no el estado del movimiento",
        ),
      ),
      clickSelectorStep(
        "tour-open-past-sim-movement",
        "[data-training-movement-id='910000119']",
        "2. Movimientos · Abre un registro terminado",
        noviceCopy(
          "Historial guarda movimientos concluidos y cancelados",
          "pulsa SIM-MOV-119",
          "verás inicio, fin y responsables; consultarlo no lo reabre",
        ),
      ),
      explainStep(
        "tour-read-past-sim-movement",
        "2. Movimientos · Lee el registro terminado",
        noviceCopy(
          "el panel expandido conserva la ruta, quién participó y las fechas de solicitud, inicio y cierre",
          "comprueba el estado concluido y compara sus tiempos; después pulsa Continuar",
          "seguirás viendo el mismo registro terminado antes de regresar a Activos",
        ),
        undefined,
        "[data-training-movement-details='910000119']",
      ),
      clickSelectorStep(
        "tour-return-active-tab",
        "[data-movements-scope='actuales']",
        "2. Movimientos · Regresa al trabajo vigente",
        noviceCopy(
          "el registro pasado conserva lo ocurrido para consulta",
          "pulsa Activos",
          "volverás a solicitudes pendientes sin alterar el historial",
        ),
      ),
    ],
  };
}

function buildCreateEditChapter(): RoleAppTourChapter {
  return {
    id: "create-edit",
    title: "3. Crear y editar",
    steps: [
      clickStep(
        "tour-create-new-movement",
        "movimientos-new-button",
        "3. Crear · Abre el formulario real",
        noviceCopy(
          "Nuevo movimiento inicia una solicitud",
          "pulsa Nuevo movimiento",
          "la capacitación creará SIM-MOV-305 sólo en esta sesión",
        ),
        "warning",
      ),
      practiceStep(
        "tour-create-locomotive",
        "3. Crear · Escribe la locomotora",
        noviceCopy(
          "este número identifica exactamente qué locomotora se moverá",
          "escribe 406 en Número de locomotora y pulsa Continuar",
          "el dato quedará sólo en el ejemplo SIM y enseguida elegirás la ruta",
        ),
        "create-movement-locomotive",
      ),
      clickSelectorStep(
        "tour-create-open-origin",
        "[data-guide-action='create-origin-open']",
        "3. Crear · Abre el origen",
        noviceCopy(
          "De vía indica dónde inicia la locomotora",
          "pulsa Selecciona una vía de origen",
          "se mostrarán únicamente las vías disponibles para este ejemplo",
        ),
      ),
      clickSelectorStep(
        "tour-create-select-origin",
        "[data-guide-action='select-training-origin']",
        "3. Crear · Elige Vía 1",
        noviceCopy(
          "cada opción muestra la vía y su disponibilidad",
          "pulsa Vía 1 · capacitación",
          "el selector se cerrará y verás Vía 1 como origen",
        ),
      ),
      clickSelectorStep(
        "tour-create-open-destination",
        "[data-guide-action='create-destination-open']",
        "3. Crear · Abre el destino",
        noviceCopy(
          "Para vía indica dónde debe terminar la locomotora",
          "pulsa Selecciona una vía de destino",
          "se abrirán las opciones de destino sin borrar el origen",
        ),
      ),
      clickSelectorStep(
        "tour-create-select-destination",
        "[data-guide-action='select-training-destination']",
        "3. Crear · Elige Vía 2",
        noviceCopy(
          "origen y destino deben ser vías diferentes",
          "pulsa Vía 2 · capacitación",
          "la ruta quedará Vía 1 → Vía 2 y el formulario podrá validarse",
        ),
      ),
      validatedStep(
        "tour-create-validate-data",
        "3. Crear · Comprueba los datos",
        noviceCopy(
          "antes de avanzar deben estar completos empresa, localidad, locomotora y ruta",
          "revisa que diga 406 y Vía 1 → Vía 2; después pulsa Validar y continuar",
          "la aplicación usará la validación real y se quedará aquí si falta algo",
        ),
        "create-movement-step-1",
        CREATE_NEXT_BUTTON,
        ["[data-guide-id='create-movement-torno-service'] button", "[data-guide-action='create-movement-exit']"],
      ),
      clickSelectorStep(
        "tour-create-type",
        "[data-guide-action='select-training-movement-type']",
        "3. Crear · Elige el tipo",
        noviceCopy(
          "MD Trabajando indica una maniobra realizada por la locomotora motriz",
          "pulsa MD Trabajando",
          "quedará seleccionado y después indicarás su orientación",
        ),
      ),
      clickSelectorStep(
        "tour-create-orientation",
        "[data-guide-action='select-training-orientation']",
        "3. Crear · Indica la orientación",
        noviceCopy(
          "la orientación le dice al personal hacia qué polo apunta la locomotora",
          "pulsa Norte en Opción A · Polo",
          "no tendrás que llenar cabina ni chimenea porque Polo ya completa la orientación",
        ),
      ),
      validatedStep(
        "tour-create-details",
        "3. Crear · Datos de la maniobra",
        noviceCopy(
          "el ejemplo ya tiene tipo MD Trabajando y orientación Norte",
          "comprueba ambos valores y pulsa Validar y continuar",
          "si un dato obligatorio falta, no avanzarás y podrás corregirlo en esta misma pantalla",
        ),
        "create-movement-step-2-standard",
        CREATE_NEXT_BUTTON,
        ["[data-guide-action='create-movement-exit']"],
      ),
      clickStep(
        "tour-create-submit",
        "create-movement-submit",
        "3. Crear · Confirma el ejemplo SIM",
        noviceCopy(
          "el resumen es la última comprobación antes de crear",
          "revisa locomotora, ruta, tipo y dirección; luego pulsa Crear movimiento SIM",
          "aparecerá SIM-MOV-305 y no se enviará nada a producción",
        ),
        "warning",
      ),
      clickSelectorStep(
        "tour-expand-created-movement",
        "[data-training-movement-id='910000305']",
        "3. Editar · Abre primero la información",
        noviceCopy(
          "SIM-MOV-305 ya aparece en la tabla como el movimiento que acabas de crear",
          "pulsa su fila para expandirla antes de editar",
          "verás el resumen completo del registro SIM y todavía no entrarás al formulario",
        ),
      ),
      explainStep(
        "tour-read-created-movement",
        "3. Editar · Verifica qué vas a cambiar",
        noviceCopy(
          "el detalle expandido identifica el folio, locomotora, empresa, localidad, ruta, estado e instrucciones",
          "confirma que sea SIM-MOV-305 y pulsa Continuar",
          "el recorrido permanecerá sobre este mismo movimiento y enseguida iluminará únicamente su botón Editar",
        ),
        undefined,
        "[data-training-movement-details='910000305']",
        "warning",
      ),
      clickSelectorStep(
        "tour-edit-created-movement",
        "[data-training-edit-movement='910000305']",
        "3. Editar · Abre sólo el registro SIM",
        noviceCopy(
          "SIM-MOV-305 ya aparece dentro de la tabla real",
          "pulsa Editar en ese registro",
          "se abrirá el editor con datos ficticios; no puedes editar otra fila durante la capacitación",
        ),
        "warning",
      ),
      validatedStep(
        "tour-edit-data",
        "3. Editar · Cambia un dato permitido",
        noviceCopy(
          "el primer paso vuelve a mostrar locomotora y ruta",
          "cambia un dato del ejemplo y pulsa Validar y continuar",
          "la validación real impedirá avanzar si la ruta queda incompleta",
        ),
        "edit-movement-step-1",
        EDIT_NEXT_BUTTON,
      ),
      validatedStep(
        "tour-edit-details",
        "3. Editar · Revisa la maniobra",
        noviceCopy(
          "aquí se actualizan tipo, dirección y posiciones",
          "confirma los valores y pulsa Validar y continuar",
          "si aparece un error, corrígelo aquí; todavía no se ha guardado nada",
        ),
        "edit-movement-step-2",
        EDIT_NEXT_BUTTON,
      ),
      clickStep(
        "tour-edit-save-open-confirmation",
        "edit-movement-save",
        "3. Editar · Solicita guardar",
        noviceCopy(
          "el resumen muestra el resultado final de la edición",
          "comprueba locomotora y ruta y pulsa Guardar cambios",
          "aparecerá una confirmación clara antes de aplicar el cambio SIM",
        ),
        "warning",
      ),
      clickSelectorStep(
        "tour-edit-save-confirmation",
        "[data-guide-action='confirm-training-edit-save']",
        "3. Editar · Confirma el cambio SIM",
        noviceCopy(
          "la ventana confirma exactamente qué registro cambiará y recuerda que no toca producción",
          "pulsa Sí, guardar cambio SIM",
          "se actualizará únicamente SIM-MOV-305 y volverás a la lista para terminar la práctica",
        ),
        "warning",
      ),
    ],
  };
}

function buildRoundsChapter(): RoleAppTourChapter {
  return {
    id: "rounds",
    title: "4. Rondas",
    steps: [
      clickStep(
        "tour-return-dashboard",
        "sidebar-menu-dashboard",
        "4. Rondas · Regresa a Operación",
        noviceCopy(
          "la ronda convierte solicitudes en un orden de atención",
          "pulsa Operación",
          "verás el ejemplo SIM junto con la localidad; todavía no cambia el orden",
        ),
      ),
      clickStep(
        "tour-open-round-editor",
        "dashboard-edit-rounds",
        "4. Rondas · Abre tus acciones",
        noviceCopy(
          "puedes ver toda la localidad, pero editar sólo lo permitido para tu empresa",
          "pulsa Editar mis rondas",
          "se abrirá el editor; durante la capacitación sólo las tarjetas SIM aceptarán cambios",
        ),
        "warning",
      ),
      clickSelectorStep(
        "tour-round-move",
        "[data-guide-id='training-round-edit-row'] [data-guide-id='round-move-down']:not(:disabled), [data-guide-id='training-round-edit-row'] [data-guide-id='round-move-up']:not(:disabled)",
        "4. Rondas · Prepara un cambio de posición",
        noviceCopy(
          "las flechas mueven una tarjeta un lugar; mover no cancela el movimiento",
          "pulsa la flecha iluminada de la tarjeta SIM",
          "aparecerá una confirmación; aún no se guarda el nuevo orden",
        ),
        "warning",
      ),
      clickStep(
        "tour-round-confirm",
        "round-edit-confirm-action",
        "4. Rondas · Confirma el nuevo lugar",
        noviceCopy(
          "la ventana compara la posición anterior con la nueva",
          "verifica la locomotora y pulsa Sí, editar la ronda",
          "sólo el orden SIM cambia; Volver cancelaría esta edición",
        ),
        "warning",
      ),
      clickSelectorStep(
        "tour-round-open-actions",
        "[data-guide-id='training-round-edit-row']:nth-child(2) [data-guide-id='round-show-actions']",
        "4. Rondas · Abre las acciones sensibles",
        noviceCopy(
          "el botón de información muestra opciones adicionales de la tarjeta",
          "púlsalo en el registro SIM",
          "sólo se mostrarán opciones; nada se cancela todavía",
        ),
        "warning",
      ),
      clickSelectorStep(
        "tour-round-cancel-request",
        "[data-guide-id='training-round-edit-row']:nth-child(2) [data-guide-id='round-cancel-movement']",
        "4. Rondas · Solicita cancelar",
        noviceCopy(
          "Quitar y cancelar elimina la tarjeta y cancela el movimiento completo",
          "pulsa Quitar y cancelar en el registro SIM",
          "se pedirá motivo y confirmación; aún puedes regresar sin cambios",
        ),
        "critical",
      ),
      {
        ...practiceStep(
          "tour-round-cancel-reason",
          "4. Rondas · Escribe el motivo",
          noviceCopy(
            "esta ventana es la última protección antes de cancelar",
            "escribe un motivo claro y pulsa Validar y continuar",
            "el botón real de confirmación se iluminará; todavía no se habrá cancelado nada",
          ),
          "round-cancel-dialog",
          undefined,
          "critical",
        ),
        disableAppElements: ["[data-guide-id='round-cancel-dialog'] button"],
      },
      clickStep(
        "tour-round-cancel-confirm",
        "round-cancel-confirm-action",
        "4. Rondas · Confirma en la aplicación",
        noviceCopy(
          "Sí, cancelar y quitar cancela el movimiento completo, no sólo la tarjeta",
          "comprueba la locomotora y pulsa el botón iluminado",
          "desaparecerá únicamente SIM-MOV-305; ningún movimiento real cambiará",
        ),
        "critical",
      ),
    ],
  };
}

function buildIncidentsChapter(): RoleAppTourChapter {
  return {
    id: "incidents",
    title: "5. Incidentes",
    steps: [
      explainStep(
        "tour-incident-alert-read",
        "5. Incidentes · Reconoce la alerta emergente",
        noviceCopy(
          "cuando se detecta un incidente de tu empresa/localidad aparece una alerta con movimiento, locomotora, ruta, evidencia y tiempo restante",
          "lee SIM-INC-041 y pulsa Continuar; no cierres la ventana con la X",
          "después practicarás Cerrar sin resolver y la aplicación pedirá confirmación",
        ),
        undefined,
        "[data-guide-id='incident-alert-dialog']",
        "critical",
      ),
      clickSelectorStep(
        "tour-incident-alert-skip",
        "[data-guide-action='incident-alert-skip']",
        "5. Incidentes · Solicita cerrar sin resolver",
        noviceCopy(
          "Cerrar sin resolver no registra una solución y en operación puede cancelar el movimiento relacionado",
          "pulsa Cerrar sin resolver",
          "todavía no ocurrirá nada: aparecerá una segunda confirmación",
        ),
        "critical",
      ),
      clickSelectorStep(
        "tour-incident-alert-skip-confirm",
        "[data-guide-action='incident-alert-skip-confirm']",
        "5. Incidentes · Confirma el efecto",
        noviceCopy(
          "Sí, aceptar es la última protección antes del cierre operativo",
          "pulsa Sí, aceptar para cerrar sólo esta simulación",
          "el ejemplo se reiniciará abierto para que también practiques cómo resolverlo correctamente",
        ),
        "critical",
      ),
      clickStep(
        "tour-open-incidents",
        "sidebar-menu-incidentes",
        "5. Incidentes · Abre la bandeja",
        noviceCopy(
          "Actuales necesita atención; Pasados conserva lo que ya se cerró",
          "pulsa Incidentes",
          "sólo verás las localidades permitidas para tu cuenta",
        ),
        "warning",
      ),
      clickSelectorStep(
        "tour-open-sim-incident",
        "[data-training-incident-id='920000041']",
        "5. Incidentes · Abre el caso correcto",
        noviceCopy(
          "cada fila identifica fecha, localidad, locomotora, descripción y estado",
          "pulsa SIM-INC-041",
          "se abrirá evidencia y acciones del caso ficticio; consultarlo no lo resuelve",
        ),
        "warning",
      ),
      {
        ...practiceStep(
          "tour-read-sim-incident",
          "5. Incidentes · Documenta la solución",
          noviceCopy(
            "Resolver registra qué se corrigió; Cerrar sin resolver exige otra confirmación y puede afectar el movimiento relacionado",
            "escribe una resolución verificable y pulsa Validar y continuar",
            "el botón real Resolver incidente se iluminará; con el campo vacío no podrás confirmar",
          ),
          "incident-resolution-panel",
          undefined,
          "warning",
        ),
        disableAppElements: ["[data-guide-id='incident-resolution-panel'] button"],
      },
      clickSelectorStep(
        "tour-resolve-sim-incident",
        "[data-training-incident-resolve]",
        "5. Incidentes · Resuelve en la aplicación",
        noviceCopy(
          "Resolver mueve el caso documentado a Pasados",
          "pulsa Resolver incidente una sola vez",
          "sólo SIM-INC-041 cambiará; la capacitación nunca enviará esta acción al backend",
        ),
        "warning",
      ),
    ],
  };
}

function buildTornoChapter(canCreate: boolean, isClientLike: boolean): RoleAppTourChapter {
  const tornoMenuLabel = isClientLike ? "Historial Torno" : "Torno";
  const steps: GuidedManualStep[] = [
    clickStep(
      "tour-open-torno",
      "sidebar-menu-torno",
      `6. Torno · Abre ${tornoMenuLabel}`,
      noviceCopy(
        "Movimiento y Torno están relacionados, pero cada uno conserva su propio estado",
        `pulsa ${tornoMenuLabel}`,
        "abrirás el seguimiento de servicios sin modificar mediciones",
      ),
    ),
    clickStep(
      "tour-torno-open-services",
      "torno-tab-historial",
      "6. Torno · Muestra Servicios",
      noviceCopy(
        "Servicios contiene activos e historial; Incidentes muestra bloqueos; Navajas registra herramienta si tu rol tiene permiso",
        "pulsa Servicios",
        "verás filtros y registros de Torno; cambiar de pestaña no altera un servicio",
      ),
    ),
  ];

  if (!canCreate) {
    steps.push(
      explainStep(
        "tour-torno-table",
        "6. Torno · Lee un servicio",
        noviceCopy(
          "la lista muestra locomotora, empresa, estado y fechas; el detalle contiene rueda, eje, medidas, responsables e incidentes",
          "usa locomotora, fecha y estado para localizar el registro correcto",
          "el PDF es evidencia; consultarlo no cambia el estado de Torno ni del movimiento",
        ),
        "torno-services-list",
      ),
    );
    return { id: "torno", title: "6. Torno", steps };
  }

  steps.push(
    clickStep(
      "tour-torno-return-movements",
      "sidebar-menu-movimientos",
      "6. Torno · Inicia una solicitud",
      noviceCopy(
        "la lista de Torno sirve para consultar; la solicitud se crea desde Movimientos",
        "pulsa Seguimiento",
        "regresarás al listado sin cambiar ningún servicio",
      ),
    ),
    clickStep(
      "tour-torno-new",
      "movimientos-new-button",
      "6. Torno · Abre Nuevo movimiento",
      noviceCopy(
        "el mismo formulario cambia cuando eliges el servicio Torno",
        "pulsa Nuevo movimiento",
        "comenzará otro ejemplo SIM; ningún servicio real se creará",
      ),
    ),
    clickSelectorStep(
      "tour-torno-select-service",
      "[data-guide-id='create-movement-torno-service'] button:nth-of-type(2)",
      "6. Torno · Selecciona el servicio correcto",
      noviceCopy(
        "Lavado y Torno abren formularios diferentes",
        "pulsa exactamente Torno",
        "aparecerán las opciones propias del torneado; todavía no se guarda nada",
      ),
    ),
    practiceStep(
      "tour-torno-locomotive",
      "6. Torno · Escribe la locomotora",
      noviceCopy(
        "la locomotora identifica el servicio y sus mediciones",
        "escribe 506 en Número de locomotora y pulsa Continuar",
        "el dato quedará únicamente en SIM-TOR-305",
      ),
      "create-movement-locomotive",
    ),
    clickSelectorStep(
      "tour-torno-open-origin",
      "[data-guide-action='create-origin-open']",
      "6. Torno · Abre la vía de origen",
      noviceCopy(
        "De vía registra desde dónde ingresa la locomotora al servicio",
        "pulsa Selecciona una vía de origen",
        "aparecerán las vías ficticias disponibles",
      ),
    ),
    clickSelectorStep(
      "tour-torno-select-origin",
      "[data-guide-action='select-training-origin']",
      "6. Torno · Selecciona Vía 1",
      noviceCopy(
        "la vía elegida queda vinculada al movimiento de Torno",
        "pulsa Vía 1 · capacitación",
        "quedarán completos locomotora y origen para validar",
      ),
    ),
    validatedStep(
      "tour-torno-service-selection",
      "6. Torno · Completa el contexto",
      noviceCopy(
        "empresa, localidad, locomotora y vía identifican el servicio",
        "comprueba Torno, locomotora 506 y Vía 1; después pulsa Validar y continuar",
        "la validación real impedirá avanzar si falta un dato o la fecha agendada no es futura",
      ),
      "create-movement-step-1",
      CREATE_NEXT_BUTTON,
      ["[data-guide-id='create-movement-torno-service'] button", "[data-guide-action='create-movement-exit']"],
    ),
    clickSelectorStep(
      "tour-torno-movement-type",
      "[data-guide-id='torno-movement-type'] button:first-of-type",
      "6. Torno · Elige el tipo",
      noviceCopy(
        "el tipo es obligatorio y está fuera de la tabla de mediciones",
        "pulsa MD Trabajando",
        "la guía habilitará la tabla sin bloquear este control",
      ),
    ),
    {
      id: "tour-torno-first-measure",
      selector: "[data-guide-id='torno-measures-table'] input[aria-label='Pulgadas enteras']",
      title: "6. Torno · Captura una medida ficticia",
      description: noviceCopy(
        "cada celda acepta pulgadas enteras y, cuando aplique, numerador/denominador",
        "escribe 30 en Pulgadas enteras y pulsa Continuar",
        "la medición quedará sólo en la capacitación y permitirá validar el paso",
      ),
      mode: "wizard",
      tone: "info",
    },
    validatedStep(
      "tour-torno-measures-explanation",
      "6. Torno · Captura mediciones",
      noviceCopy(
        "cada fila corresponde a una rueda/posición y cada columna indica una medida",
        "comprueba MD Trabajando y la medida 30; después pulsa Validar y continuar",
        "si falta una medida obligatoria o un parámetro, permanecerás aquí para corregirlo",
      ),
      "torno-measures-table",
      CREATE_NEXT_BUTTON,
      ["[data-guide-action='create-movement-exit']"],
    ),
    clickStep(
      "tour-torno-submit",
      "create-movement-submit",
      "6. Torno · Confirma el ejemplo",
      noviceCopy(
        "el resumen une locomotora, vía, ruedas, tipo, dirección y comentarios",
        "revísalo y pulsa Crear movimiento SIM",
        "se creará SIM-TOR-305 sólo para esta capacitación",
      ),
      "warning",
    ),
    explainStep(
      "tour-torno-created-review",
      "6. Torno · Movimiento SIM creado",
      noviceCopy(
        `SIM-TOR-305 ya aparece en Movimientos; al inicio del recorrido también aprendiste dónde consultar ${tornoMenuLabel}`,
        "comprueba folio, locomotora 506, origen Vía 1, destino Torno y estado SOLICITADO; después pulsa Continuar",
        "el recorrido terminará aquí sin hacer otra navegación y ningún dato se enviará a producción",
      ),
      undefined,
      "[data-training-movement-id='910000305']",
      "success",
    ),
  );
  return { id: "torno", title: "6. Torno", steps };
}

function buildAccessChapter(role: TrainingRole): RoleAppTourChapter | null {
  const steps: GuidedManualStep[] = [];
  if (role === "COORDINADOR" || role === "ADMINISTRADOR") {
    steps.push(
      clickStep(
        "tour-open-users",
        "sidebar-menu-usuarios",
        "7. Acceso · Abre Usuarios",
        noviceCopy(
          "rol, empresa y localidad deciden qué puede ver y hacer una cuenta",
          "pulsa Usuarios y revisa esos tres datos antes de cualquier alta o cambio",
          "durante esta capacitación no se guardará ningún usuario",
        ),
        "warning",
      ),
    );
  }
  if (role === "ADMINISTRADOR") {
    steps.push(
      clickStep(
        "tour-open-config",
        "sidebar-menu-configuracion",
        "7. Acceso · Abre Configuración",
        noviceCopy(
          "empresas, localidades, vías y catálogos alimentan formularios y permisos",
          "pulsa Configuración y localiza el catálogo antes de editar",
          "la capacitación sólo explica; no desactives ni dupliques registros",
        ),
        "critical",
      ),
    );
  }
  if (role === "COORDINADOR" || role === "ADMINISTRADOR") {
    steps.push(
      clickStep(
        "tour-open-reports",
        "sidebar-menu-reporteria",
        "7. Acceso · Abre Reportería",
        noviceCopy(
          "los totales dependen de periodo, empresa, localidad y servicio",
          "pulsa Reportería y comprueba los filtros visibles antes de leer o exportar",
          "consultar no cambia la operación; un filtro incorrecto sí produce una conclusión incorrecta",
        ),
      ),
    );
  }
  return steps.length ? { id: "access", title: "7. Usuarios y reportes", steps } : null;
}

function buildOperationalChapters(role: TrainingRole): RoleAppTourChapter[] {
  const chapters: RoleAppTourChapter[] = [buildDashboardChapter(role), buildMovementsChapter()];
  const canCreate = role !== "SUPERVISOR";
  const canManageRounds = role.startsWith("CLIENTE");
  const canUseTorno = role !== "ADMINISTRADOR";
  if (canCreate) chapters.push(buildCreateEditChapter());
  if (canManageRounds) chapters.push(buildRoundsChapter());
  chapters.push(buildIncidentsChapter());
  if (canUseTorno) chapters.push(buildTornoChapter(canCreate, role.startsWith("CLIENTE")));
  const access = buildAccessChapter(role);
  if (access) chapters.push(access);
  if (role === "CLIENTE_ADMIN" || role === "CLIENTE_COOR") {
    chapters.push(buildArrastreChapter());
  }
  return chapters;
}

function buildCommercialChapter(): RoleAppTourChapter {
  const modules = [
    ["commercial_general", "Reporte general", "contratos, consumo, cortes y saldos", "verifica periodo y cliente"],
    ["commercial_clients", "Clientes", "datos y relaciones comerciales", "abre el cliente correcto"],
    ["commercial_contracts", "Contratos", "vigencia, paquete, precio y condiciones", "comprueba la vigencia"],
    ["commercial_packages", "Paquetes", "límites y precios para contratos", "revisa dependencias antes de editar"],
    ["commercial_collections", "Cobranza", "cortes, pagos y saldos", "concilia cliente y periodo"],
    ["commercial_reports", "Reportería", "resultados filtrados y exportaciones", "valida filtros y total"],
  ] as const;
  return {
    id: "commercial",
    title: "Flujo comercial",
    steps: modules.map(([menuId, title, what, action], index) => clickStep(
      `tour-commercial-open-${menuId}`,
      `sidebar-menu-${menuId}`,
      `${index + 1}/6 · ${title}`,
      noviceCopy(
        what,
        `${action} y pulsa ${title}`,
        "abrirás la pantalla real; el recorrido no guardará cambios comerciales",
      ),
    )),
  };
}

function buildArrastreChapter(): RoleAppTourChapter {
  return {
    id: "arrastre",
    title: "Flujo de arrastre",
    steps: [
      clickStep(
        "tour-arrastre-dashboard",
        "sidebar-menu-dashboard",
        "1/3 · Tablero de Torreón",
        noviceCopy(
          "el tablero ordena arrastres y muestra su capacidad",
          "pulsa Dashboard",
          "verás la ronda autorizada; consultar no cambia el orden",
        ),
      ),
      clickStep(
        "tour-arrastre-movements",
        "sidebar-menu-torreon_arrastres",
        "2/3 · Arrastres",
        noviceCopy(
          "un vagón cargado vale 2 puntos y uno vacío 1; el máximo operativo es 8",
          "comprueba orden, ruta y puntos, y pulsa Arrastres",
          "abrirás solicitudes de vagones; no se mezclan con movimientos naturales",
        ),
      ),
      clickStep(
        "tour-arrastre-incidents",
        "sidebar-menu-incidentes",
        "3/3 · Incidentes",
        noviceCopy(
          "cada arrastre muestra vagones, condición, ruta, puntos y comentarios",
          "revisa la composición y pulsa Incidentes",
          "verás sólo tu localidad; resolver documenta la corrección y cerrar sin resolver puede afectar la solicitud",
        ),
      ),
    ],
  };
}

export function buildRoleAppTourChapters(role: TrainingRole): RoleAppTourChapter[] {
  if (role === "COMERCIAL") return [buildCommercialChapter()];
  if (role === "ARRASTRE_TORREON") return [buildArrastreChapter()];
  return buildOperationalChapters(role);
}

export function buildRoleAppTourChapterSteps(
  role: TrainingRole,
  chapterId: RoleAppTourChapterId,
): GuidedManualStep[] {
  const chapter = chapterId === "arrastre"
    ? buildArrastreChapter()
    : chapterId === "incidents" && role === "ARRASTRE_TORREON"
      ? buildIncidentsChapter()
    : buildRoleAppTourChapters(role).find((candidate) => candidate.id === chapterId);
  return chapter
    ? withMobileMenuOpeners(chapter.steps.map((step) => ({ ...step, chapter: chapter.title })))
    : [];
}

export function buildRoleAppTourSteps(role: TrainingRole): GuidedManualStep[] {
  const chapters = buildRoleAppTourChapters(role).map((chapter, chapterIndex) => ({
    ...chapter,
    steps: withMobileMenuOpeners(
      chapter.steps.map((step) => ({ ...step, chapter: chapter.title })),
      chapterIndex > 0,
    ),
  }));
  let steps: GuidedManualStep[] = chapters.flatMap((chapter) => (
    chapter.steps
  ));
  const finishConditions: NonNullable<GuidedManualStep["when"]>[] = [];

  const gateAfterChapter = (
    chapterId: RoleAppTourChapterId,
    condition: NonNullable<GuidedManualStep["when"]>,
  ) => {
    const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (chapterIndex < 0) return;
    const chapterEnd = chapters
      .slice(0, chapterIndex + 1)
      .reduce((total, chapter) => total + chapter.steps.length, 0);
    steps = [
      ...steps.slice(0, chapterEnd),
      ...withCondition(steps.slice(chapterEnd), condition),
    ];
    finishConditions.push(condition);
  };

  if (chapters.some((chapter) => chapter.id === "create-edit")) {
    gateAfterChapter(
      "create-edit",
      () => typeof document !== "undefined" && !document.querySelector("[data-guide-id='edit-movement-step-3']"),
    );
  }

  if (role.startsWith("CLIENTE")) {
    gateAfterChapter(
      "rounds",
      () => typeof document !== "undefined"
        && !Array.from(document.querySelectorAll("[data-guide-id='training-round-edit-row']"))
          .some((node) => node.textContent?.includes("SIM-MOV-305")),
    );
  }

  gateAfterChapter(
    "incidents",
    () => typeof document !== "undefined" && !document.querySelector("[data-guide-id='incident-resolution-panel']"),
  );

  const roleLabel = role === "COMERCIAL"
    ? "Comercial"
    : role === "ARRASTRE_TORREON"
      ? "Arrastre Torreón"
      : operationalRoleLabel(role);
  const terminalSteps = [finishStep(roleLabel), safeCloseStep()];
  return [
    ...steps,
    ...(finishConditions.length
      ? withCondition(terminalSteps, { type: "all", conditions: finishConditions })
      : terminalSteps),
  ];
}

export function roleBaseForTraining(role: TrainingRole) {
  return routesFor(role).base;
}
