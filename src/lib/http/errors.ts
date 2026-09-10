export class ClientRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly retryable: boolean) {
    super(message); this.name = 'ClientRequestError';
  }
}

export async function responseError(response: Response): Promise<ClientRequestError> {
  let detail = '';
  if ((response.headers.get('content-type') || '').includes('application/json')) {
    const payload = await response.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
    const raw = payload?.message ?? payload?.error;
    if (typeof raw === 'string') detail = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').slice(0,180);
  }
  const known: Record<number,string> = {
    400: detail || 'Revisa los datos enviados.', 401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
    403: 'Esta acción no está habilitada para tu cuenta.', 404: 'El registro solicitado ya no está disponible.',
    409: detail || 'La información cambió. Actualiza e inténtalo de nuevo.',
    422: detail || 'Hay datos que necesitan corrección.', 429: 'Hay muchas solicitudes en curso. Espera un momento.',
  };
  return new ClientRequestError(known[response.status] || 'El servicio no pudo completar la solicitud. Puedes reintentar.', response.status, `HTTP_${response.status}`, response.status === 429 || response.status >= 500 || response.status === 408);
}
