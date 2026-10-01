import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginProfile } from './fixtures/authorization';
import MovementEditPage from '@/features/movimientos/editar/MovementEditPage';

const session = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/session', () => ({ getVerifiedSession: session }));
vi.mock('@/features/movimientos/editar/EditarMovimiento', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

beforeEach(() => session.mockResolvedValue({ role: 'CLIENTE', localidadId: 2, authorization: loginProfile() }));

describe('movement editor source and role', () => {
  it('opens Torreón for a local client even through an old link', async () => {
    const page = await MovementEditPage({ searchParams: Promise.resolve({ id: '4' }) });
    expect(page.props.children.props).toMatchObject({ movimientoId: 4, source: 'torreon' });
  });
  it.each([
    { localidadId: 1, source: 'torreon' },
    { localidadId: 2, source: 'cosaif' },
  ])('keeps the selected movement source $source when the session locality is $localidadId', async ({ localidadId, source }) => {
    session.mockResolvedValue({ role: 'CLIENTE_ADMIN', localidadId, authorization: loginProfile('CLIENTE_ADMIN') });
    const page = await MovementEditPage({ searchParams: Promise.resolve({ id: '4', source }) });
    expect(page.props.children.props.source).toBe(source);
  });
  it.each(['SUPERVISOR', 'COORDINADOR'] as const)('does not open the editor for %s with old permissions', async role => {
    session.mockResolvedValue({ role, localidadId: 2, authorization: loginProfile(role) });
    await expect(MovementEditPage({ searchParams: Promise.resolve({ id: '4', source: 'torreon' }) })).rejects.toThrow('redirect:');
  });
});
