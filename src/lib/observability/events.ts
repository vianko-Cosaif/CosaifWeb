export type TelemetryEvent = {
  kind: 'vital' | 'error';
  name: string;
  value?: number;
  route: string;
  at: number;
};

// Keep route families only: never log query strings, identifiers or user-entered text.
const ROUTES = new Set(['login', 'administrador', 'coordinador', 'supervisor', 'cliente', 'comercial', 'movimientos', 'incidentes', 'torno', 'torreon']);
export function routeFamily(path: string) {
  const segment = path.split('?')[0].split('/').filter(Boolean)[0];
  return ROUTES.has(segment) ? `/${segment}` : '/other';
}

export function parseTelemetry(input: unknown): TelemetryEvent[] {
  if (!Array.isArray(input) || input.length > 10) return [];
  return input.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const event = item as Record<string, unknown>;
    if (!['vital', 'error'].includes(String(event.kind)) || !['CLS', 'FCP', 'INP', 'LCP', 'TTFB', 'render'].includes(String(event.name))) return [];
    if (typeof event.at !== 'number' || !Number.isFinite(event.at) || typeof event.route !== 'string') return [];
    if (event.kind === 'vital' && (typeof event.value !== 'number' || !Number.isFinite(event.value) || event.value < 0 || event.value > 600_000)) return [];
    return [{ kind: event.kind as TelemetryEvent['kind'], name: String(event.name), value: typeof event.value === 'number' ? event.value : undefined, route: routeFamily(event.route), at: event.at }];
  });
}
