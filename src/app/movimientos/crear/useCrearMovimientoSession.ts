import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Movimiento } from "../Movimiento";
import { baseInitialForm, type MovementFormData, type Rol } from "../movimientos.shared";
import type { UserSession } from "./controller.types";

/**
 * MODULO: useCrearMovimientoSession
 *
 * Responsabilidad:
 * - Resolver identidad/rol del usuario en cliente.
 * - Aplicar restricciones de formulario por permisos.
 * - Exponer helpers para inicializar y revalidar datos bloqueados.
 *
 * Este archivo NO:
 * - Carga catalogos.
 * - Persiste draft/outbox.
 * - Envia movimientos.
 */

const COMPANY_MANAGER_ROLES = ["ADMINISTRADOR", "COORDINADOR"];
const LOCALITY_MANAGER_ROLES = ["ADMINISTRADOR"];
type StoredUser = {
  id?: number;
  rol?: string;
  role?: string;
  empresaId?: number | null;
  empresa?: { id?: number; nombre?: string } | null;
};

function readUserFromStorage(storage: Storage | null): StoredUser | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    return parsed ?? null;
  } catch {
    return null;
  }
}

/**
 * Lee sesion de usuario del navegador con prioridad:
 * 1) sessionStorage.user
 * 2) localStorage.user
 */
export function readStoredUserClient(): StoredUser | null {
  if (typeof window === "undefined") return null;
  return readUserFromStorage(window.sessionStorage) ?? readUserFromStorage(window.localStorage);
}

/**
 * Resuelve el rol activo en cliente usando:
 * 1) cookie role
 * 2) sessionStorage/localStorage.user
 * 3) fallback CLIENTE
 */
export function getRoleClient(): Rol {
  const c = String(Movimiento.getCookie("role") || "").trim().toUpperCase();
  if (c) return c as Rol;
  const u = readStoredUserClient();
  const r = String(u?.rol || u?.role || "").toUpperCase();
  if (r) return r as Rol;
  return "CLIENTE";
}

/**
 * Hook de sesion para flujo crear movimiento.
 *
 * Entradas:
 * - setForm: setter global del formulario del wizard.
 *
 * Salidas:
 * - rol/user/canManageAll
 * - initFormLocked(): inicializacion completa.
 * - enforceLockedLocality(): re-aplica localidad cuando rol es restringido.
 */
export function useCrearMovimientoSession(setForm: Dispatch<SetStateAction<MovementFormData>>) {
  const [rol, setRol] = useState<Rol>("CLIENTE");
  const [userCompanyName, setUserCompanyName] = useState("");
  const [user, setUser] = useState<UserSession>(null);

  const canManageAll = useMemo(
    () => COMPANY_MANAGER_ROLES.includes(String(rol).toUpperCase()),
    [rol]
  );
  const canChooseLocality = useMemo(
    () => LOCALITY_MANAGER_ROLES.includes(String(rol).toUpperCase()),
    [rol]
  );

  /**
   * Inicializa el formulario con campos bloqueados segun rol y sesion.
   * Este paso debe ejecutarse antes de cargar catalogos y draft.
   */
  const initFormLocked = useCallback(() => {
    const role = getRoleClient();
    setRol(role);

    const locCookie = Number(Movimiento.getCookie("locId") || NaN);
    const empCookie = Number(Movimiento.getCookie("empresaId") || NaN);
    const userIdCookie = Number(Movimiento.getCookie("userId") || NaN);

    const u = readStoredUserClient();

    setUser(u || null);
    setUserCompanyName(u?.empresa?.nombre || "");

    const canChooseCompany = COMPANY_MANAGER_ROLES.includes(String(role).toUpperCase());
    const canChooseAssignedLocality = LOCALITY_MANAGER_ROLES.includes(String(role).toUpperCase());

    const resolvedUserId = Number.isFinite(Number(u?.id))
      ? Number(u?.id)
      : (Number.isFinite(userIdCookie) ? userIdCookie : null);

    const base: MovementFormData = {
      ...baseInitialForm,
      creadoPorId: resolvedUserId,
      clienteId: resolvedUserId,
      empresaId: canChooseCompany
        ? null
        : (Number.isFinite(Number(u?.empresaId ?? u?.empresa?.id))
          ? Number(u?.empresaId ?? u?.empresa?.id)
          : (Number.isFinite(empCookie) ? empCookie : null)),
      selectedLocalityId: canChooseAssignedLocality ? null : (Number.isFinite(locCookie) ? locCookie : null),
    };

    setForm((prev) => ({
      ...base,
      ...prev,
      creadoPorId: base.creadoPorId ?? prev.creadoPorId,
      clienteId: base.clienteId ?? prev.clienteId,
      empresaId: !canChooseCompany ? (base.empresaId ?? prev.empresaId) : prev.empresaId,
      selectedLocalityId: !canChooseAssignedLocality ? (base.selectedLocalityId ?? prev.selectedLocalityId) : prev.selectedLocalityId,
    }));
  }, [setForm]);

  /** Reaplica localidad bloqueada para roles con alcance restringido. */
  const enforceLockedLocality = useCallback(() => {
    setRol(getRoleClient());
    if (!canChooseLocality) {
      const locCookie = Number(Movimiento.getCookie("locId") || NaN);
      setForm((p) => ({
        ...p,
        selectedLocalityId: Number.isFinite(locCookie) ? locCookie : p.selectedLocalityId,
      }));
    }
  }, [canChooseLocality, setForm]);

  return {
    rol,
    user,
    userCompanyName,
    canManageAll,
    canChooseLocality,
    adminRoles: COMPANY_MANAGER_ROLES,
    localityAdminRoles: LOCALITY_MANAGER_ROLES,
    initFormLocked,
    enforceLockedLocality,
  };
}
