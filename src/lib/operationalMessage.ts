export function operationalMessage(event: Record<string, unknown>) {
  const raw = String(event.tipo ?? event.type ?? '');
  const state = String(event.estado ?? '').toUpperCase();
  let kind = raw;
  if (raw.endsWith('movimiento.estado')) kind = ({ EN_PROCESO: event.estadoAnterior === 'DETENIDO' ? 'movimiento_reanudado' : 'movimiento_iniciado', DETENIDO: 'movimiento_detenido', CONCLUIDO: 'movimiento_concluido', CANCELADO: 'movimiento_cancelado' } as Record<string, string>)[state] || raw;
  if (raw.endsWith('movimiento.creado') || raw === 'torreon_movimiento_creado') kind = 'nuevo_movimiento';
  if (raw.endsWith('movimiento.incidente')) kind = 'nuevo_incidente';
  if (raw.endsWith('incidente.estado')) kind = state === 'RESUELTO' ? 'incidente_resuelto' : state === 'CERRADO' ? 'incidente_cerrado' : 'nuevo_incidente';
  const titles: Record<string, string> = {
    nuevo_movimiento: 'Nueva solicitud de movimiento', movimiento_iniciado: 'Movimiento iniciado',
    movimiento_reanudado: 'Movimiento reanudado', movimiento_detenido: 'Movimiento detenido',
    movimiento_concluido: 'Movimiento finalizado', movimiento_cancelado: 'Movimiento cancelado',
    nuevo_incidente: 'Incidente reportado', incidente_resuelto: 'Incidente resuelto',
    incidente_cerrado: 'Incidente cerrado', movimiento_pendiente_recordatorio: 'Movimiento pendiente de iniciar',
  };
  const title = String(event.notificationTitle || titles[kind] || event.title || 'Actualización de operación');
  const locomotive = event.locomotiveNumber ?? event.locomotora;
  const details = [locomotive ? `Locomotora ${locomotive}` : null,
    event.movimientoId ? `Movimiento #${event.movimientoId}` : event.arrastreId ? `Arrastre #${event.arrastreId}` : null,
    event.localidad || event.localidadNombre || (event.localidadId ? `Patio ${event.localidadId}` : null)];
  const body = String(event.notificationBody || event.body || event.descripcion || details.filter(Boolean).join(' · '));
  return { title, body, kind };
}
