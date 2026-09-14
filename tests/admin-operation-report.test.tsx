// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOperationReport } from '@/features/reporteria/administrador/operacion/useOperationReport';
import OperationReport from '@/features/reporteria/administrador/operacion/OperationReport';
const metrics = { total: 2, concluded: 1, cancelled: 0, stopped: 0, pending: 1, incidents: 2, affected: 1, incidentRate: 50, waitN: 1, waitMedian: 60, waitP90: 60, executionN: 1, executionMedian: 5, executionP90: 5, withinTarget: 1, targetRate: 100, overTarget: 0, missingWait: 1, withIssues: 1, durationShort: 1, durationAcceptable: 0, durationLong: 0, durationUnassessed: 1, acceptableRate: 0, waitAverage: 60, executionAverage: 5, excessMinutes: 0, incidentMinutes: 0, incidentDays: 0, incidentTimeN: 1, incidentTimeMissing: 0, clientDelayDays: 0, clientDelayMinutes: 0, clientDelayN: 0, clientDelayMissing: 0, concludedMinutes: 5, durationOpen: 1, durationMissing: 0, cancelledByIncidentLimit: 0, reprogrammed: 0, elapsedN: 2, elapsedTotal: 70, elapsedAverage: 35, liveExecutionMinutes: 0, elapsedOpenN: 1 };
function fixture(id = 'report-1') { return { meta: { id, generatedAt: '2026-09-14T16:00:00Z', expiresAt: new Date(Date.now() + 600000).toISOString(), from: '2026-08-16', to: '2026-09-14', previousStart: '2026-07-17T06:00:00Z', previousEndExclusive: '2026-08-16T06:00:00Z', target: 60, company: 'Todas las empresas', client: 'Todos los clientes', locality: 'Todas las localidades', type: 'ALL', warnings: [], comparisonCovered: true, firstRequest: '2025-11-01T12:00:00Z', lastRequest: '2026-09-14T15:00:00Z', zone: 'America/Mexico_City' }, retries: [], destinations: [{ ...metrics, key: 'lathe', label: 'Torno', completedVia: 0, completedService: 1, serviceRequests: 1, completed: metrics, clients: [], companies: [] }, { ...metrics, key: 'wash', label: 'Lavado', completedVia: 1, completedService: 0, serviceRequests: 0, completed: metrics, clients: [], companies: [] }], summary: metrics, baseline: metrics, companies: [], clients: [{ ...metrics, key: '1:7', label: 'Cliente A · Empresa A', client: 'Cliente A', company: 'Empresa A', companyId: 1, clientId: 7 }], vias: [], shifts: [], days: [], hours: [], routes: [], locomotives: [], operators: [], states: [{ key: 'SOLICITADO', label: 'Solicitado', ...metrics }], quality: [{ key: 'missingEnd', label: 'Finalizado sin fecha de fin', count: 1 }], methodology: [{ label: 'Cómo se cuenta', text: 'Una fila por movimiento.' }], catalogs: { clients: [{ id: 7, nombre: 'Cliente A', companyIds: [1] }], companies: [{ id: 1, nombre: 'Empresa A' }], localities: [{ id: 1, nombre: 'Guadalajara' }] }, insights: [{ title: 'Una solicitud pendiente', detail: 'Estado actual.', action: 'Revisar su cierre.', filter: 'pending' }], incidents: { reporters: [], resolved: 0, closed: 2, resolutionAverage: null, resolutionMedian: null, resolutionP90: null, resolutionN: 0, resolutionMissing: 0, oldestOpen: 0, frequent: [], total: 2, open: 0, durationN: 2, medianClose: 5, missingClose: 0 } }; }
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; }
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockResolvedValue(Response.json(fixture())); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('reportería administrativa', () => {
  it('modificar un filtro no altera las cifras ni dispara una consulta hasta aplicar', async () => {
    const { result } = renderHook(() => useOperationReport());
    await waitFor(() => expect(result.current.report?.summary.total).toBe(2));
    act(() => result.current.setDraft(f => ({ ...f, companyId: '1' })));
    expect(result.current.dirty).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => result.current.exportReport('excel')); expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.apply());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain('companyId=1');
  });
  it('descarta respuestas tardías de otra selección y limpia el reporte anterior', async () => {
    const delayed = deferred<Response>(); fetchMock.mockReturnValueOnce(delayed.promise).mockResolvedValueOnce(Response.json(fixture('new-report')));
    const { result } = renderHook(() => useOperationReport());
    act(() => result.current.setDraft(f => ({ ...f, companyId: '1' })));
    act(() => result.current.apply());
    await waitFor(() => expect(result.current.report?.meta.id).toBe('new-report'));
    await act(async () => delayed.resolve(Response.json(fixture('old-report'))));
    expect(result.current.report?.meta.id).toBe('new-report');
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('explica error de sesión y no muestra cifras vacías como ceros', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'No autorizado' }, { status: 401 }));
    render(<OperationReport />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Tu sesión terminó'));
    expect(screen.queryByRole('button', { name: 'Descargar Excel' })).toBeNull();
  });
  it('un hallazgo abre el detalle con el filtro correspondiente', async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
    render(<OperationReport />);
    await waitFor(() => expect(screen.getByText('Una solicitud pendiente')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Revisar movimientos' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('/detalle?') && url.includes('filter=pending'))).toBe(true));
  });
  it('calidad abre los movimientos de esa revisión sin mezclar otros registros', async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
    render(<OperationReport />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calidad y definiciones' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Calidad y definiciones' }));
    fireEvent.click(screen.getByRole('button', { name: /Finalizado sin fecha de fin/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('issue=missingEnd'))).toBe(true));
  });
  it('descargar usa el identificador consultado y rechaza una respuesta HTML', async () => {
    const { result } = renderHook(() => useOperationReport());
    await waitFor(() => expect(result.current.report).not.toBeNull());
    fetchMock.mockResolvedValueOnce(new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } }));
    await act(async () => result.current.exportReport('pdf'));
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('/bff/reporteria/admin/operacion/report-1/pdf');
    expect(result.current.downloadError).toContain('formato esperado'); expect(result.current.download).toBe('');
  });
});

it('la banda corta abre duración menor de 10, separada del objetivo de espera', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('button', { name: /Revisar.*Menos de 10 minutos/ })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Revisar.*Menos de 10 minutos/ }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('filter=short') && url.includes('sort=shortest'))).toBe(true));
});
it('cliente y banda navegan con identificadores exactos y permiten quitar el grupo', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Empresas, clientes y vías' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Empresas, clientes y vías' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clientes por empresa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Duración y atención' }));
  fireEvent.click(screen.getByRole('button', { name: 'Menos de 10 min · Revisar: Cliente A · Empresa A' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('group=client') && url.includes('groupKey=1%3A7') && url.includes('filter=short'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Quitar grupo' }));
  await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).not.toContain('group='));
});
it('espera y reintenta cuando una consulta anterior sigue terminando en el servidor', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ message: 'Ocupado' }, { status: 429, headers: { 'Retry-After': '0.1' } })).mockResolvedValueOnce(Response.json(fixture()));
  const { result } = renderHook(() => useOperationReport());
  await waitFor(() => expect(result.current.report?.summary.total).toBe(2));
  expect(result.current.error).toBe(''); expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('muestra retraso del cliente sin categoría sin evaluar y abre sus movimientos', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Retraso del cliente' })).toBeTruthy());
  expect(screen.queryByText(/sin evaluar/i)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver retrasos y fechas' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('filter=client_delay'))).toBe(true));
});
it('entradas a torno requieren estado concluido y destino exacto', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Empresas, clientes y vías' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Empresas, clientes y vías' }));
  fireEvent.click(screen.getByRole('button', { name: 'Torno y lavado' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ver entradas' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('group=destination') && url.includes('groupKey=lathe') && url.includes('state=CONCLUIDO'))).toBe(true));
});

it('una respuesta antigua o incompleta se explica sin romper la pantalla', async () => {
  const data = { ...fixture(), summary: { ...metrics } }; Reflect.deleteProperty(data.summary, 'clientDelayMinutes');
  fetchMock.mockResolvedValue(Response.json(data));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('El reporte recibido está incompleto'));
  expect(screen.queryByRole('heading', { name: 'Retraso del cliente' })).toBeNull();
});

it('permite abrir entradas identificadas por servicio cuando falta la vía', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(fixture()));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Empresas, clientes y vías' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Empresas, clientes y vías' }));
  fireEvent.click(screen.getByRole('button', { name: 'Torno y lavado' }));
  expect(screen.getByText(/0 entradas con vía de destino registrada y 1 identificadas por el servicio/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ver entradas identificadas por servicio' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('groupKey=lathe') && url.includes('filter=destination_service') && url.includes('state=CONCLUIDO'))).toBe(true));
});

it('por cliente muestra días y minutos sin mezclar lecturas y abre incidentes por impacto', async () => {
  const data = fixture();
  data.clients[0] = { ...data.clients[0], incidentMinutes: 2160, incidentDays: 1.5, clientDelayMinutes: 2880, clientDelayDays: 2, clientDelayN: 1 };
  fetchMock.mockImplementation(async (url: string) => url.includes('/detalle') ? Response.json({ rows: [], total: 0, page: 1, pages: 1, pageSize: 25 }) : Response.json(data));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Empresas, clientes y vías' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Empresas, clientes y vías' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clientes por empresa' }));
  const incident = screen.getByRole('button', { name: 'Ver tiempo con incidentes: Cliente A · Empresa A' });
  expect(incident.textContent).toContain('1.5 días'); expect(incident.textContent).toContain('2,160 min');
  const delay = screen.getByRole('button', { name: 'Ver retraso del cliente: Cliente A · Empresa A' });
  expect(delay.textContent).toContain('2 días'); expect(delay.textContent).toContain('2,880 min');
  expect(screen.queryByRole('columnheader', { name: /Menos de 10/ })).toBeNull();
  fireEvent.click(incident);
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('groupKey=1%3A7') && url.includes('filter=incident') && url.includes('sort=impact'))).toBe(true));
});
it('tiempos no calculables por cliente muestran Sin datos en lugar de cero días', async () => {
  const data = fixture();
  data.clients[0] = { ...data.clients[0], incidentTimeN: 0, incidentTimeMissing: 1, clientDelayMissing: 1 };
  fetchMock.mockResolvedValue(Response.json(data));
  render(<OperationReport />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Empresas, clientes y vías' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Empresas, clientes y vías' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clientes por empresa' }));
  for (const name of ['Ver tiempo con incidentes: Cliente A · Empresa A', 'Ver retraso del cliente: Cliente A · Empresa A']) {
    expect(screen.getByRole('button', { name }).textContent).toContain('Sin datos');
    expect(screen.getByRole('button', { name }).textContent).not.toContain('0 días');
  }
});
