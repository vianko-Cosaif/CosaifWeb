import { expect, it } from 'vitest';
import { matchesNotificationAudience as matches } from '@/lib/notificationAudience';
const viewer = { role: 'CLIENTE', empresaId: 100, localidadId: 10 };
const data = { recipientRoles: 'CLIENTE,COORDINADOR,SUPERVISOR', empresaId: '100', localidadId: '10' };
it('requires matching role, company and patio for every client profile', () => {
  expect(matches(data, viewer)).toBe(true);
  expect(matches(data, { ...viewer, localidadId: 20 })).toBe(false);
  expect(matches({ ...data, empresaId: 200, empresaNombre: 'same name' }, viewer)).toBe(false);
  expect(matches(data, { ...viewer, role: 'MAQUINISTA' })).toBe(false);
  expect(matches(data, { ...viewer, role: 'ADMINISTRADOR' })).toBe(false);
  for (const role of ['CLIENTE_ADMIN', 'CLIENTE_COOR', 'ARRASTRE_TORREON']) {
    expect(matches({ ...data, recipientRoles: [role] }, { ...viewer, role })).toBe(true);
    expect(matches({ ...data, recipientRoles: [role] }, { ...viewer, role, localidadId: 20 })).toBe(false);
    expect(matches({ ...data, recipientRoles: [role], empresaId: 200 }, { ...viewer, role })).toBe(false);
  }
});
it('allows local control across companies but rejects unknown scope and expired reminders', () => {
  expect(matches(data, { role: 'COORDINADOR', localidadId: 10 })).toBe(true);
  expect(matches(data, { role: 'SUPERVISOR', localidadId: 20 })).toBe(false);
  expect(matches(data, {})).toBe(false);
  expect(matches({ ...data, recipientRoles: '' }, viewer)).toBe(false);
  expect(matches({ ...data, localidadId: null }, viewer)).toBe(false);
  expect(matches({ ...data, expiresAt: '2026-09-18T13:00:00Z' }, viewer, Date.parse('2026-09-18T13:00:00Z'))).toBe(false);
});
