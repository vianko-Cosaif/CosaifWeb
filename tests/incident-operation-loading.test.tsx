// @vitest-environment jsdom
import React, { Suspense, lazy, type ComponentType, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginProfile } from './fixtures/authorization';
import type { IncidenteRow, Meta } from '@/features/incidentes/operacion/types';
import IncidenteController from '@/features/incidentes/operacion/IncidenteController';
const mocks = vi.hoisted(() => ({ read: vi.fn(), realtime: vi.fn() }));
vi.mock('@/lib/http/client', () => ({ cachedFetchJson: mocks.read, invalidateCachedJson: vi.fn() }));
vi.mock('@/features/movimientos/useRealtimeMovimientos', () => ({ useRealtimeMovimientos: mocks.realtime }));
vi.mock('@/lib/auth/storageScope', () => ({ currentStorageScope: () => 'test-account' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('next/dynamic', () => ({ default: (loader: () => Promise<{ default: ComponentType }>) => {
  const Component = lazy(loader);
  return function Dynamic(props: Record<string, unknown>) { return <Suspense fallback={<div>Loading module</div>}><Component {...props}/></Suspense>; };
} }));
vi.mock('@/features/capacitacion', () => ({ GuidedTarget: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/features/capacitacion/TrainingTourContext', () => ({ TRAINING_INCIDENT_ID: 920000041, useTrainingTour: () => ({ active: false }) }));
vi.mock('@/features/incidentes/operacion/IncidentesTable', () => ({ default: ({ data, meta, onPageChange, onRefresh }: { data: IncidenteRow[]; meta: Meta; onPageChange: (page: number) => void; onRefresh: () => void }) => <div>
  <div data-testid="rows">{data.map(row => `${row.id}:${row.descripcion}:${row.empresa ?? '-'}`).join('|')}</div>
  <span data-testid="page">{meta.page}</span><button onClick={() => onPageChange(2)}>Página dos</button><button onClick={onRefresh}>Actualizar tabla</button>
</div> }));
const incident = (id: number, estado = 'ABIERTO', complete = true) => ({ id, estado, descripcion: `Incidente ${id}`, fechaInicio: '2026-09-08T12:00:00Z', movimiento: { id, empresaId: 3, localidadId: 1, locomotiveNumber: 123, ...(complete ? { empresa: { nombre: 'Propia' }, viaOrigen: { nombre: '3' }, viaDestino: { nombre: '4' } } : {}) } });
const envelope = (data: ReturnType<typeof incident>[], page = 1) => ({ success: true, data, meta: { page, pageSize: 20, total: 40, totalPages: 2 } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const listCalls = () => mocks.read.mock.calls.filter(([url]) => String(url).startsWith('/api/incidentes?'));
function serve(read: (url: string, init: RequestInit) => Promise<unknown>) {
  mocks.read.mockImplementation((url: string, init: RequestInit = {}) => url.startsWith('/bff/') ? Promise.resolve({ id: 3, nombre: 'Empresa' }) : read(url, init));
}
beforeEach(() => { mocks.read.mockReset(); mocks.realtime.mockReset().mockReturnValue('connected'); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('operational incident page loading', () => {
  it('shows the first page before optional detail enrichment and only requests details missing from that page', async () => {
    const detail = deferred<unknown>();
    serve(async url => url.includes('/501') ? detail.promise : envelope([incident(501, 'ABIERTO', false), incident(502), incident(503, 'RESUELTO')]));
    render(<IncidenteController authorization={loginProfile('CLIENTE')}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('501:Incidente 501'));
    expect(screen.getByTestId('rows').textContent).toContain('502:Incidente 502:Propia');
    expect(mocks.read.mock.calls.filter(([url]) => /\/api\/incidentes\/\d/.test(url)).map(([url]) => url)).toEqual(['/api/incidentes/501']);
    const url = new URL(listCalls()[0][0], 'https://test');
    expect(url.searchParams.get('empresaId')).toBe('3'); expect(url.searchParams.get('localidadId')).toBe('1');
    await act(async () => detail.resolve({ data: { ...incident(501), movimiento: { ...incident(501).movimiento, empresa: { nombre: 'Detalle disponible' } } } }));
    expect(screen.getByTestId('rows').textContent).toContain('Detalle disponible');
  });

  it('aborts an obsolete request and ignores a late response from the previous tab', async () => {
    const old = deferred<unknown>(); let oldSignal: AbortSignal | null | undefined;
    serve(async (url, init) => { if (url.includes('estado=ABIERTO')) { oldSignal = init.signal; return old.promise; } return envelope([incident(602, 'RESUELTO')]); });
    render(<IncidenteController authorization={loginProfile('CLIENTE')}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Pasados' }));
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('602:'));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => old.resolve(envelope([incident(601)])));
    expect(screen.getByTestId('rows').textContent).not.toContain('601:');
  });

  it('clears the old page immediately and restarts at page one when changing tabs', async () => {
    const history = deferred<unknown>();
    serve(async url => url.includes('PASADOS') ? history.promise : envelope([incident(url.includes('page=2') ? 702 : 701)], url.includes('page=2') ? 2 : 1));
    render(<IncidenteController authorization={loginProfile('SUPERVISOR')}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('701:'));
    fireEvent.click(screen.getByRole('button', { name: 'Página dos' }));
    await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Pasados' }));
    expect(screen.getByTestId('rows').textContent).not.toContain('702:');
    expect(listCalls().at(-1)?.[0]).toContain('page=1');
    await act(async () => history.resolve(envelope([incident(703, 'CERRADO')])));
    expect(screen.getByTestId('rows').textContent).toContain('703:');
  });

  it('preserves useful data on a failed refresh and exposes a retry instead of an empty table', async () => {
    let fail = false;
    serve(async () => { if (fail) throw new Error('Servicio temporalmente no disponible'); return envelope([incident(801)]); });
    render(<IncidenteController authorization={loginProfile('CLIENTE')}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('801:'));
    fail = true;
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar tabla' }));
    await waitFor(() => expect(screen.getByText('Servicio temporalmente no disponible')).toBeTruthy());
    expect(screen.getByTestId('rows').textContent).toContain('801:');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('uses the signed company-wide scope without waiting for an unrelated locality', async () => {
    serve(async () => envelope([incident(901)]));
    const authorization = loginProfile('CLIENTE_ADMIN');
    authorization.scope = { mode: 'COMPANY', empresaId: 3, localidadId: null };
    render(<IncidenteController authorization={authorization}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('901:'));
    const url = new URL(listCalls()[0][0], 'https://test');
    expect(url.searchParams.get('empresaId')).toBe('3'); expect(url.searchParams.has('localidadId')).toBe(false);
    expect(listCalls()).toHaveLength(1);
  });

  it('keeps the requested second page when realtime and polling refresh during its pending read', async () => {
    const second = deferred<unknown>();
    let secondSignal: AbortSignal | null | undefined;
    serve(async (url, init) => {
      if (url.includes('page=2')) { secondSignal = init.signal; return second.promise; }
      return envelope([incident(1001)]);
    });
    render(<IncidenteController authorization={loginProfile('SUPERVISOR')}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('1001:'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Página dos' }));
    expect(screen.getByTestId('page').textContent).toBe('2');
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: 'incidente.estado', localidadId: 1, eventId: 'second-page' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(listCalls()).toHaveLength(2);
    expect(secondSignal?.aborted).toBe(false);
    await act(async () => second.resolve(envelope([incident(1002)], 2)));
    expect(screen.getByTestId('page').textContent).toBe('2');
    expect(screen.getByTestId('rows').textContent).toContain('1002:');
    expect(listCalls().slice(1).every(([url]) => new URL(url, 'https://test').searchParams.get('page') === '2')).toBe(true);
  });

  it('cancels an already scheduled refresh on Auto off or hide and revalidates after returning', async () => {
    serve(async () => envelope([incident(1101)]));
    render(<IncidenteController authorization={loginProfile('CLIENTE')}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('1101:'));
    vi.useFakeTimers();
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: 'incidente.estado', localidadId: 1, eventId: 'pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(listCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: 'incidente.estado', localidadId: 1, eventId: 'hide' }));
    act(() => { visible.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(listCalls()).toHaveLength(1);
    act(() => { visible.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => {});
    expect(listCalls()).toHaveLength(2);
  });

  it('forces one fresh read when an actual incident change arrives after ready scheduled the timer', async () => {
    serve(async () => envelope([incident(1201)]));
    render(<IncidenteController authorization={loginProfile('CLIENTE')}/>);
    await waitFor(() => expect(screen.getByTestId('rows').textContent).toContain('1201:'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: 'realtime.ready' }));
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: 'incidente.estado', localidadId: 1, eventId: 'changed' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(listCalls()).toHaveLength(2);
    expect(listCalls()[1][2]).toMatchObject({ force: true });
  });

});
