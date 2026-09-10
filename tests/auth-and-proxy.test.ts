import { describe, expect, it } from 'vitest';
import { AUTHORIZATION_POLICY_VERSION, getRoleCapabilities, PERMISSIONS, type AppRole, type AuthorizationProfile, type Permission } from '@/lib/accessControl';
import { canForwardApiRequest } from '@/lib/server/requestAuthorization';
import { safeReturnPath } from '@/lib/auth/returnPath';
import { storageScope } from '@/lib/auth/storageScope';
import { buildUpstreamHeaders, upstreamResponseHeaders } from '@/lib/server/upstream';
export function profile(role: AppRole, permissions: Permission[]): AuthorizationProfile {
  return { role, roleLabel: role, policyVersion: AUTHORIZATION_POLICY_VERSION, platforms: { web: true, mobile: false }, scope: { mode: 'GLOBAL', empresaId: null, localidadId: null }, permissions, capabilities: getRoleCapabilities(role) };
}
describe('authorization boundaries', () => {
  it('requires edit permission separately from operate and cancel', () => {
    const operator = profile('COORDINADOR', [PERMISSIONS.MOVEMENTS_OPERATE]);
    expect(canForwardApiRequest(operator, '/movimientos/4/edicion', 'PATCH')).toBe(false);
    expect(canForwardApiRequest(operator, '/movimientos/4/cancelar', 'PATCH')).toBe(false);
    expect(canForwardApiRequest(profile('COORDINADOR', [PERMISSIONS.MOVEMENTS_EDIT]), '/movimientos/4/edicion', 'PATCH')).toBe(true);
  });
  it('denies unrecognized paths and access to commercial actions without the commercial role', () => {
    const client = profile('CLIENTE', Object.values(PERMISSIONS));
    expect(canForwardApiRequest(client, '/unrecognized', 'GET')).toBe(false);
    expect(canForwardApiRequest(client, '/comercial/contratos', 'POST')).toBe(false);
    expect(canForwardApiRequest(profile('COMERCIAL', [PERMISSIONS.REPORTS_COMMERCIAL_READ]), '/comercial/contratos', 'POST')).toBe(true);
  });
  it('requires report export permission for PDF GETs', () => {
    const report = profile('ADMINISTRADOR', [PERMISSIONS.REPORTS_ADMIN_READ]);
    expect(canForwardApiRequest(report, '/reporteria/admin', 'GET')).toBe(true);
    expect(canForwardApiRequest(report, '/reporteria/admin/pdf', 'GET')).toBe(false);
  });
  it('only returns to an authorized local page', () => {
    const client = profile('CLIENTE', [PERMISSIONS.MOVEMENTS_READ]);
    for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', '/api/auth/logout', '/administrador', '/login']) expect(safeReturnPath(path, client, '/cliente')).toBe('/cliente');
    expect(safeReturnPath('/cliente/movimientos?estado=DETENIDO', client, '/cliente')).toBe('/cliente/movimientos?estado=DETENIDO');
  });
  it('matches client storage to signed session scope and isolates accounts', () => {
    expect(storageScope({ id: 4, rol: 'CLIENTE', empresaId: 3, localidadId: 1 })).toBe(storageScope({ userId: 4, role: 'CLIENTE', empresaId: 3, localidadId: 1 }));
    expect(storageScope({ id: 4, role: 'CLIENTE' })).not.toBe(storageScope({ id: 5, role: 'CLIENTE' }));
  });
  it('forwards idempotency to the backend header and strips cookies', () => {
    const headers = buildUpstreamHeaders(new Request('http://test', { headers: { 'idempotency-key': 'request-12345', cookie: 'secret' } }), 'test-token');
    expect(headers.get('x-idempotency-key')).toBe('request-12345'); expect(headers.has('cookie')).toBe(false); expect(headers.has('x-request-id')).toBe(true);
  });
  it('preserves retry and download headers without a stale compressed Content-Length', () => {
    const headers = upstreamResponseHeaders(new Response(null, { headers: { 'retry-after': '2', 'content-length': '10', 'content-encoding': 'gzip', 'content-disposition': 'attachment; filename=test.pdf' } }));
    expect(headers.get('retry-after')).toBe('2'); expect(headers.has('content-length')).toBe(false); expect(headers.has('content-encoding')).toBe(false); expect(headers.get('content-disposition')).toContain('test.pdf');
  });
});
