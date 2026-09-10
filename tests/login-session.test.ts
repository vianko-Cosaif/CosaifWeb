import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken, hasSecureSessionSecret, SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/sessionToken';
import { proxy } from '@/proxy';
import { loginProfile } from './fixtures/authorization';

const testSecret = 'only-for-automated-tests-never-use-in-production-123';
beforeEach(() => { vi.stubEnv('SESSION_SECRET', testSecret); vi.stubEnv('JWT_SECRET', ''); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function session() { return { role: 'CLIENTE' as const, userId: 7, empresaId: 3, localidadId: 1, authorization: loginProfile() }; }

describe('signed login session', () => {
  it('keeps installations configured with JWT_SECRET compatible', async () => {
    vi.stubEnv('SESSION_SECRET', ''); vi.stubEnv('JWT_SECRET', testSecret);
    expect(hasSecureSessionSecret()).toBe(true);
    const token = await createSessionToken(session(), 3600);
    expect(await verifySessionToken(token)).toMatchObject({ userId: 7, role: 'CLIENTE' });
  });
  it('does not weaken the minimum secret length or fall back from an invalid explicit secret', () => {
    vi.stubEnv('SESSION_SECRET', 'short'); vi.stubEnv('JWT_SECRET', testSecret);
    expect(hasSecureSessionSecret()).toBe(false);
  });
  it('allows the authenticated panel and redirects unauthenticated requests to login', async () => {
    const token = await createSessionToken(session(), 3600);
    const authorized = await proxy(new NextRequest('http://localhost:3012/cliente', { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }));
    expect(authorized.headers.get('x-middleware-next')).toBe('1');
    const missing = await proxy(new NextRequest('http://localhost:3012/cliente'));
    expect(missing.headers.get('location')).toContain('/login?next=');
  });
  it('rejects a tampered token', async () => {
    const token = await createSessionToken(session(), 3600);
    const parts = token.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    expect(await verifySessionToken(parts.join('.'))).toBeNull();
  });
  it('creates HttpOnly cookies through the actual BFF route and those cookies pass the proxy', async () => {
    vi.stubEnv('API_ORIGIN', 'http://backend.test');
    const { POST } = await import('@/app/bff/login/route');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'synthetic-backend-token', authorization: loginProfile(), user: { id: 7, empresaId: 3, localidadId: 1 } }), { status: 200 })));
    const result = await POST(new NextRequest('http://localhost:3012/bff/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3012' }, body: JSON.stringify({ nombre: 'synthetic-test', contrasena: 'synthetic-test' }) }));
    expect(result.status).toBe(200);
    const cookie = result.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.httpOnly).toBe(true); expect(result.cookies.get('token')?.httpOnly).toBe(true);
    expect(await result.json()).not.toHaveProperty('token');
    const landing = await proxy(new NextRequest('http://localhost:3012/cliente', { headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie?.value}` } }));
    expect(landing.headers.get('x-middleware-next')).toBe('1');
  });
});
