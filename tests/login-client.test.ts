import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '@/features/auth/loginClient';
import { loginProfile } from './fixtures/authorization';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
function response(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status }); }
function validPayload(role: Parameters<typeof loginProfile>[0] = 'CLIENTE') {
  return { user: { id: 7, nombre: 'Prueba', empresaId: 3, localidadId: 1 }, authorization: loginProfile(role) };
}
describe('login client', () => {
  it('posts credentials once to the same origin and uses the authorized return path', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(validPayload())); vi.stubGlobal('fetch', fetcher);
    const result = await authenticate(' prueba ', 'sample-password', '/cliente/movimientos');
    expect(result.destination).toBe('/cliente/movimientos'); expect(result.user.id).toBe(7);
    expect(result.user).not.toHaveProperty('token');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/bff/login', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ nombre: 'prueba', contrasena: 'sample-password' }) }));
  });
  it.each(['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'CLIENTE', 'COMERCIAL'] as const)('enters the %s area without waiting for notifications', async (role) => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(validPayload(role))));
    expect((await authenticate('test', 'test', '//external.invalid')).destination).toBe(`/${role.toLowerCase()}`);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
  it('uses locality from the authorized scope for Torreon even when UI user fields are absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_TORREON_LOCALIDAD_IDS', '2');
    const payload = validPayload(); payload.authorization.scope.localidadId = 2;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ authorization: payload.authorization, user: { id: 7 } })));
    const result = await authenticate('test', 'test', null);
    expect(result.destination).toBe('/cliente/torreon'); expect(result.user.localidadId).toBe(2);
  });
  it.each([500, 502, 503, 504])('does not blame credentials for HTTP %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>upstream unavailable</html>', { status })));
    await expect(authenticate('test', 'test', null)).rejects.toThrow(/servicio/);
  });
  it('reports invalid credentials and rate limits distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({}, 429)));
    await expect(authenticate('test', 'test', null)).rejects.toThrow(/Usuario o contraseña incorrectos/);
    await expect(authenticate('test', 'test', null)).rejects.toThrow(/límite de intentos/);
  });
  it('rejects a malformed successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ user: { id: 0 } })));
    await expect(authenticate('test', 'test', null)).rejects.toThrow(/validar tu perfil/);
  });
  it('releases a stalled request with an actionable timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))));
    const assertion = expect(authenticate('test', 'test', null)).rejects.toThrow(/tardando/);
    await vi.advanceTimersByTimeAsync(20_000); await assertion;
  });
});
