'use client';
export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="es"><body style={{ fontFamily: 'system-ui', padding: 32 }}><main><h1>No se pudo abrir COSAIF</h1><p>Recarga esta pantalla para volver a conectar.</p><button onClick={reset}>Volver a intentar</button></main></body></html>;
}
