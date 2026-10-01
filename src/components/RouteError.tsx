'use client';
import { useEffect } from 'react';
import { reportClientEvent } from '@/lib/observability/client';
import Button from '@/components/ui/Button';
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientEvent({ kind: 'error', name: 'render' }); }, [error]);
  return <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 p-6" role="alert">
    <h1 className="text-2xl font-bold">No se pudo mostrar esta pantalla</h1>
    <p className="text-[var(--app-text-muted)]">Vuelve a intentarlo. Los registros confirmados y tus borradores guardados permanecen disponibles.</p>
    {error.digest ? <p className="text-sm">Referencia: {error.digest}</p> : null}
    <Button onClick={reset}>Volver a intentar</Button>
  </main>;
}
