/** Backend recipientRoles is the notification contract; state updates without it stay silent. */
export type NotificationViewer = { role?: string | null; empresaId?: number | null; localidadId?: number | null };
export function matchesNotificationAudience(data: Record<string, unknown> | undefined, viewer: NotificationViewer, now = Date.now()) {
  if (!data) return false;
  const role = String(viewer.role ?? '').toUpperCase();
  const roles = Array.isArray(data.recipientRoles) ? data.recipientRoles : String(data.recipientRoles ?? '').split(',');
  if (!role || !roles.includes(role)) return false;
  const yard = Number(data.localidadId);
  if (!(yard > 0) || !(Number(viewer.localidadId) > 0) || yard !== Number(viewer.localidadId)) return false;
  const patioStart = data.notificationScope === 'patio'
    && ['CLIENTE', 'CLIENTE_ADMIN', 'CLIENTE_COOR'].includes(role)
    && (['movimiento_iniciado', 'torreon_movimiento_iniciado'].includes(String(data.tipo))
      || (['movimiento.estado', 'torreon.movimiento.estado'].includes(String(data.type))
        && data.estado === 'EN_PROCESO' && data.estadoAnterior !== 'DETENIDO'));
  if (!patioStart && ['CLIENTE', 'CLIENTE_ADMIN', 'CLIENTE_COOR', 'ARRASTRE_TORREON'].includes(role)) {
    const company = Number(data.empresaId);
    if (!(company > 0) || !(Number(viewer.empresaId) > 0) || company !== Number(viewer.empresaId)) return false;
  }
  if (data.expiresAt && !(Date.parse(String(data.expiresAt)) > now)) return false;
  return true;
}
