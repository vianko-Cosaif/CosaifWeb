import { getEmpresaIdClient, getLocIdClient, getRoleClient } from './cookies';
export function currentNotificationViewer() {
  let user: Record<string, any> = {};
  try { user = JSON.parse(window.localStorage.getItem('user') || '{}'); } catch { /* signed out */ }
  return {
    id: Number(user.id) || null,
    role: getRoleClient() ?? String(user.rol || user.role || '').toUpperCase(),
    empresaId: getEmpresaIdClient() ?? (Number(user.empresaId ?? user.empresa?.id) || null),
    localidadId: getLocIdClient() ?? (Number(user.localidadId ?? user.localidad?.id) || null),
  };
}
