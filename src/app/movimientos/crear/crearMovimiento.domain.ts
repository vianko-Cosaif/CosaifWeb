import type { MovementFormData, Rol } from "../movimientos.shared";
import type { ResolvedIds, SelectionMode, UserSession } from "./controller.types";
import type { TornoMedicionState } from "./tornoMedicion.types";
import { buildBackendTornoMedidas } from "./tornoSubmit.adapter";

/**
 * MODULO: crearMovimiento.domain
 *
 * Responsabilidad:
 * - Concentrar reglas puras de negocio del flujo "crear movimiento".
 * - Exponer funciones deterministas para validacion y armado de payload.
 *
 * Este archivo NO:
 * - Usa hooks de React.
 * - Lee browser APIs (cookies, localStorage, window).
 * - Hace llamadas a la API.
 *
 * Beneficio:
 * - Facil test unitario.
 * - Menor acoplamiento con UI y side effects.
 */

/** Retorna true solo para numeros positivos validos (ID valido). */
export const isPos = (n: number) => Number.isFinite(n) && n > 0;

/**
 * Resuelve IDs efectivos segun rol y fuente de datos confiable.
 *
 * Orden general de prioridad:
 * - Admin/Coord: valor elegido en formulario (si es valido).
 * - Roles restringidos: sesion/cookies y fallback a formulario.
 */
export function resolveIds(args: {
  rol: Rol;
  adminRoles: string[];
  form: Pick<MovementFormData, "empresaId" | "creadoPorId" | "selectedLocalityId">;
  user: UserSession;
  cookieEmp: number;
  cookieLoc: number;
  cookieUserId: number;
}): ResolvedIds {
  const { rol, adminRoles, form, user, cookieEmp, cookieLoc, cookieUserId } = args;
  const role = String(rol).toUpperCase();

  const forcedEmpresa = Number(user?.empresaId ?? user?.empresa?.id ?? NaN);
  const rawFormEmp = Number(form.empresaId ?? NaN);
  const empresaId = adminRoles.includes(role)
    ? (isPos(rawFormEmp) ? rawFormEmp : NaN)
    : (isPos(forcedEmpresa)
      ? forcedEmpresa
      : isPos(cookieEmp)
        ? cookieEmp
        : isPos(rawFormEmp)
          ? rawFormEmp
          : NaN);

  const rawFormUser = Number(form.creadoPorId ?? NaN);
  const rawStateUser = Number(user?.id ?? NaN);
  const creadoPorId = isPos(rawFormUser)
    ? rawFormUser
    : isPos(rawStateUser)
      ? rawStateUser
      : isPos(cookieUserId)
        ? cookieUserId
        : NaN;

  const rawFormLoc = Number(form.selectedLocalityId ?? NaN);
  const localidadId = adminRoles.includes(role)
    ? (isPos(rawFormLoc) ? rawFormLoc : NaN)
    : (isPos(cookieLoc)
      ? cookieLoc
      : isPos(rawFormLoc)
        ? rawFormLoc
        : NaN);

  return { empresaId, creadoPorId, localidadId };
}

/**
 * Validacion del Step 1.
 * Cobertura:
 * - empresa/localidad (segun permisos).
 * - vias requeridas por modo.
 * - locomotora obligatoria.
 */
export function validateStep1Data(args: {
  canManageAll: boolean;
  resolvedIds: ResolvedIds;
  form: Pick<MovementFormData, "service" | "fromTrack" | "toTrack" | "locomotiveNumber">;
  selectionMode: SelectionMode;
}): Record<string, string> {
  const { canManageAll, resolvedIds, form, selectionMode } = args;
  const e: Record<string, string> = {};

  if (canManageAll && !Number.isFinite(resolvedIds.empresaId)) e.empresaId = "Selecciona empresa.";
  if (canManageAll && !Number.isFinite(resolvedIds.localidadId)) e.selectedLocalityId = "Selecciona localidad.";

  if (form.service) {
    if (selectionMode === "de_via" && !form.fromTrack) e.fromTrack = "Selecciona via de origen.";
    if (selectionMode === "para_via" && !form.toTrack) e.toTrack = "Selecciona via de destino.";
  } else {
    if (!form.fromTrack) e.fromTrack = "Selecciona via de origen.";
    if (!form.toTrack) e.toTrack = "Selecciona via de destino.";
  }

  if (!form.locomotiveNumber.trim()) e.locomotiveNumber = "Numero requerido.";

  return e;
}

/**
 * Validacion del Step 2.
 * Cobertura:
 * - tipo de movimiento.
 * - reglas de posicionamiento (polo/chimenea).
 * - direccion obligatoria en remolcada.
 */
export function validateStep2Data(args: {
  form: Pick<MovementFormData, "movementType" | "service" | "polo" | "chimneyPosition" | "direccionEmpuje">;
}): Record<string, string> {
  const { form } = args;
  const e: Record<string, string> = {};

  if (!form.movementType) e.movementType = "Selecciona el tipo de movimiento.";

  if (!form.service) {
    if (form.polo === "Sin_Solicitar" && !["DENTRO", "AFUERA"].includes(form.chimneyPosition)) {
      e.chimneyPosition = "Selecciona posicion de chimenea.";
    }
    if (form.chimneyPosition === "Sin_Solicitar" && !["NORTE", "SUR"].includes(form.polo)) {
      e.polo = "Selecciona polo o posicion de chimenea.";
    }
  }

  if (form.movementType === "REMOLCADA" && !["EMPUJAR", "JALAR"].includes(form.direccionEmpuje || "")) {
    e.direccionEmpuje = "Selecciona EMPUJAR o JALAR.";
  }

  return e;
}

/**
 * Normaliza vias activas segun modo de seleccion y existencia de servicio.
 * Devuelve solo las vias validas para payload final.
 */
export function resolveTracksByMode(args: {
  service: MovementFormData["service"];
  selectionMode: SelectionMode;
  fromTrack: number | null;
  toTrack: number | null;
}) {
  const { service, selectionMode, fromTrack, toTrack } = args;
  const effectiveMode: SelectionMode = selectionMode;
  return {
    fromTrack: (!service || effectiveMode === "de_via") ? fromTrack : null,
    toTrack: (!service || effectiveMode === "para_via") ? toTrack : null,
  };
}

/**
 * Construye texto final de instrucciones con metadatos de secciones.
 * Formato:
 * - prefijos [META ...]
 * - detalle textual de origen/destino
 * - comentario libre
 */
export function buildInstrucciones(args: {
  fromTrack: number | null;
  toTrack: number | null;
  fromSection?: number;
  toSection?: number;
  polo: MovementFormData["polo"];
  comments: string;
  viaName: (id?: number | null) => string;
}) {
  const { fromTrack, toTrack, fromSection, toSection, polo, comments, viaName } = args;

  const meta: string[] = [];
  if (typeof toSection === "number") meta.push(`[META DESTINO:${toSection}]`);
  if (typeof fromSection === "number") meta.push(`[META ORIGEN:${fromSection}]`);

  const partes: string[] = [];
  if (fromTrack) {
    partes.push(`De la via ${viaName(fromTrack)}${typeof fromSection === "number" ? ` (seccion ${fromSection})` : ""}`);
  }
  if (toTrack) {
    partes.push(`para la via ${viaName(toTrack)}${typeof toSection === "number" ? ` (seccion ${toSection})` : ""}`);
  }
  if (polo && polo !== "Sin_Solicitar") {
    partes.push(`| Posicion: ${polo} | `);
  }

  return [meta.join(" "), partes.join(" "), comments.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Fabrica el payload de creacion listo para API.
 *
 * Salidas:
 * - payload: objeto final para POST /movimientos.
 * - viaParaAsignar/numeroParaAsignar: datos auxiliares para POST de asignacion de seccion.
 */
export function buildMovimientoPayload(args: {
  resolvedIds: ResolvedIds;
  form: MovementFormData;
  selectionMode: SelectionMode;
  fromSection?: number;
  toSection?: number;
  userId?: number;
  viaName: (id?: number | null) => string;
  tornoMedicion?: TornoMedicionState;
  companyName?: string;
  scheduledActivationId?: number | null;
  recoveredCancelledTornoId?: number | null;
}) {
  const {
    resolvedIds,
    form,
    selectionMode,
    fromSection,
    toSection,
    userId,
    viaName,
    tornoMedicion,
    companyName,
    scheduledActivationId,
    recoveredCancelledTornoId,
  } = args;
  const { empresaId, creadoPorId, localidadId } = resolvedIds;

  const { fromTrack, toTrack } = resolveTracksByMode({
    service: form.service,
    selectionMode,
    fromTrack: form.fromTrack,
    toTrack: form.toTrack,
  });

  const numeroSeccion =
    form.service && (typeof toSection === "number" || typeof fromSection === "number")
      ? Number(typeof toSection === "number" ? toSection : (fromSection as number))
      : undefined;

  const instrucciones = buildInstrucciones({
    fromTrack,
    toTrack,
    fromSection,
    toSection,
    polo: form.polo,
    comments: form.comments || "",
    viaName,
  });

  const payload: Record<string, unknown> = {
    empresaId: Number(empresaId),
    creadoPorId: Number(creadoPorId),
    clienteId: Number(form.clienteId ?? userId ?? creadoPorId),
    localidadId: Number(localidadId),

    ...(fromTrack ? { viaOrigenId: Number(fromTrack) } : {}),
    ...(toTrack ? { viaDestinoId: Number(toTrack) } : {}),
    ...(numeroSeccion !== undefined ? { numeroSeccion } : {}),

    locomotiveNumber: Number(form.locomotiveNumber),
    prioridad: form.priority ? "ALTA" : "BAJA",

    tipoMovimiento: ["MD_TRABAJANDO", "REMOLCADA"].includes(form.movementType)
      ? form.movementType
      : undefined,
    direccionEmpuje:
      form.movementType === "REMOLCADA" && ["EMPUJAR", "JALAR"].includes(form.direccionEmpuje || "")
        ? form.direccionEmpuje
        : "Sin_Solicitar",
    posicionCabina: !form.service && ["DENTRO", "AFUERA"].includes(form.cabinPosition)
      ? form.cabinPosition
      : "Sin_Solicitar",
    posicionChimenea: !form.service && ["DENTRO", "AFUERA"].includes(form.chimneyPosition)
      ? form.chimneyPosition
      : "Sin_Solicitar",

    ...(form.service === "Lavado" ? { lavado: true } : {}),
    ...(form.service === "Torno" ? { torno: true } : {}),

    ...(instrucciones ? { instrucciones } : {}),

    finalizado: false,
    incidenteGlobal: false,
  };

  if (form.service === "Torno" && selectionMode === "de_via") {
    if (!tornoMedicion) {
      throw new Error("No hay mediciones de torno disponibles para este movimiento.");
    }

    payload.medidasTorno = buildBackendTornoMedidas({
      tornoMedicion,
      companyName,
    });

    if (form.agendado) {
      payload.agendado = true;
      payload.fechaProgramada = form.fechaProgramada;
    }

    if (scheduledActivationId) {
      payload.activarAgendadoId = scheduledActivationId;
    }

    if (recoveredCancelledTornoId) {
      payload.recuperarTornoCanceladoId = recoveredCancelledTornoId;
      payload.ignorarAgendado = true;
    }
  }

  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const viaParaAsignar =
    typeof toSection === "number" && form.toTrack
      ? form.toTrack
      : (typeof fromSection === "number" && form.fromTrack ? form.fromTrack : null);

  const numeroParaAsignar =
    typeof toSection === "number"
      ? toSection
      : (typeof fromSection === "number" ? fromSection : undefined);

  return {
    payload,
    fromTrack,
    toTrack,
    viaParaAsignar,
    numeroParaAsignar,
  };
}

/**
 * Aplica defaults derivados de catalogos una vez cargados.
 * Regla clave:
 * - Si hay una sola opcion valida en admin/coord, autoselecciona.
 */
export function applyCatalogDefaults(args: {
  form: MovementFormData;
  user: UserSession;
  adminRoles: string[];
  role: Rol;
  empresas: { id: number }[];
  localidades: { id: number }[];
  cookieEmp: number;
}) {
  const { form, user, adminRoles, role, empresas, localidades, cookieEmp } = args;

  let empresaId = form.empresaId ?? (user?.empresaId ?? user?.empresa?.id ?? (Number.isFinite(cookieEmp) ? cookieEmp : null));
  if (adminRoles.includes(String(role).toUpperCase())) {
    if (!Number.isFinite(Number(empresaId)) && empresas.length === 1) empresaId = empresas[0].id;
  }

  let localidadId = form.selectedLocalityId;
  const canAll = adminRoles.includes(String(role).toUpperCase());
  if (!Number.isFinite(Number(localidadId)) && canAll && localidades.length === 1) {
    localidadId = localidades[0].id;
  }

  return {
    ...form,
    empresaId: Number.isFinite(Number(empresaId)) ? Number(empresaId) : form.empresaId,
    selectedLocalityId: Number.isFinite(Number(localidadId)) ? Number(localidadId) : (form.selectedLocalityId ?? null),
  };
}
