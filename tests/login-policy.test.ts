import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { APP_ROLES, getRoleCapabilities, parseAuthorizationProfile, PERMISSIONS, type AppRole } from '@/lib/accessControl';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/sessionToken';

// Deliberately literal: this is the version emitted by BackCosaif2, not a client default.
function upstreamPayload(role: AppRole = 'CLIENTE') {
  const capabilities = getRoleCapabilities(role);
  const authorization = {
    policyVersion: 3,
    role, roleLabel: role,
    platforms: { web: capabilities.canUseWeb, mobile: true },
    scope: { mode: role === 'ADMINISTRADOR' ? 'GLOBAL' : 'COMPANY_LOCALITY', empresaId: 17, localidadId: 3 },
    permissions: [PERMISSIONS.SESSION_READ, PERMISSIONS.MOVEMENTS_READ],
    capabilities,
  };
  return {
    token: 'synthetic-upstream-token',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: 42, rol: role, empresaId: 17, localidadId: 3 },
    authorization,
  };
}

let requestId = 0;
async function login(payload: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload, { status })));
  const { POST } = await import('@/app/bff/login/route');
  return POST(new NextRequest('http://localhost:3012/bff/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3012' },
    body: JSON.stringify({ nombre: `synthetic-${++requestId}`, contrasena: 'synthetic-password' }),
  }));
}

beforeEach(() => {
  vi.stubEnv('API_ORIGIN', 'http://localhost:3001');
  vi.stubEnv('SESSION_SECRET', 'synthetic-session-secret-only-for-tests-20260908');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('login authorization contract v3', () => {
  it.each(APP_ROLES.filter(role => getRoleCapabilities(role).canUseWeb))('accepts %s and verifies its signed session', async role => {
    const payload = upstreamPayload(role);
    const response = await login(payload);
    expect(response.status).toBe(200);
    const session = await verifySessionToken(response.cookies.get(SESSION_COOKIE_NAME)?.value);
    expect(session).toMatchObject({ role, userId: 42, empresaId: 17, localidadId: 3, authorization: { policyVersion: 3 } });
    const body = await response.json();
    expect(body.token).toBeUndefined();
    expect(parseAuthorizationProfile(body.authorization)).toEqual(payload.authorization);
    expect(response.cookies.get('token')).toMatchObject({ httpOnly: true });
  });

  it.each(APP_ROLES.filter(role => !getRoleCapabilities(role).canUseWeb))('keeps %s blocked on the web', async role => {
    const response = await login(upstreamPayload(role));
    expect(response.status).toBe(403);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it.each([2, 4])('rejects unsupported policy version %s', async policyVersion => {
    const payload = upstreamPayload();
    payload.authorization.policyVersion = policyVersion;
    const response = await login(payload);
    expect(response.status).toBe(403);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it('rejects company scope mismatches', async () => {
    const payload = upstreamPayload();
    payload.user.empresaId = 99;
    const response = await login(payload);
    expect(response.status).toBe(403);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it('preserves invalid credential errors from the API', async () => {
    const response = await login({ error: 'Credenciales inválidas' }, 401);
    expect(response.status).toBe(401);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
