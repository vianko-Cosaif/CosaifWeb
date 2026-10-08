"use client";
import TorreonNaturalQueue from '../naturales/components/TorreonNaturalQueue';
export default function TorreonNaturalesPanel({ localidadId, rol = 'COORDINADOR' }: { localidadId: number; apiBase?: string; variant?: 'dashboard' | 'movimientos'; rol?: 'ADMINISTRADOR' | 'COORDINADOR' | 'SUPERVISOR' }) {
  return <TorreonNaturalQueue localidadId={localidadId} rol={rol} />;
}
