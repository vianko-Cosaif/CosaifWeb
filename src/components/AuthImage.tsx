"use client";
import { useEffect, useState } from 'react';
import { API, fetchImageObjectURL } from '@/lib/api';

export default function AuthImage({ ruta, alt = 'Evidencia del incidente', className }: { ruta?: string; alt?: string; className?: string }) {
  const [src, setSrc] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true; let objectUrl: string | undefined;
    setError(false); setSrc(undefined);
    if (!ruta) { setError(true); return; }
    void fetchImageObjectURL(API.IMG(ruta)).then(url => {
      objectUrl = url;
      if (alive) setSrc(url); else URL.revokeObjectURL(url);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [ruta]);
  if (error) return <div className={`grid place-items-center bg-slate-100 text-slate-500 ${className || ''}`}><span className="text-xs">Sin imagen</span></div>;
  if (!src) return <div className={`animate-pulse bg-slate-100 ${className || ''}`} role="status" aria-label="Cargando imagen"/>;
  // eslint-disable-next-line @next/next/no-img-element -- La evidencia autenticada se descarga una vez y se representa mediante una URL blob revocable.
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async"/>;
}
