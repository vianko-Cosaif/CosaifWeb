// /hooks/useEditRondaWeb.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { invalidateCachedJson } from '@/lib/clientRequestCache';
import { isTrainingMovementId, isTrainingRoundId } from '@/lib/routePolicy';

/* =======================
   CONFIG
   ======================= */
/**
 * Base del BFF same-origin. Mantén "/bff" para que se envíe la cookie.
 * Si quieres sobreescribir en build, usa NEXT_PUBLIC_API_BASE="/bff".
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '/bff').replace(/\/+$/, '');

/* ==============
   TIPOS / MODELOS
   ============== */
export interface Ronda {
  id: number;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
  source?: 'cosaif' | 'torreon' | 'torno' | string;
  empresa?: { id: number; nombre: string } | null;
  movimientoId?: number | null;
  createdAt?: string | null;
  movimiento: {
    id?: number;
    idTecnico?: number | null;
    folioLocalidad?: number | null;
    folioLocalidadLabel?: string | null;
    title?: string;
    description?: string;
    date?: string;
    prioridad?: 'BAJA' | 'MEDIA' | 'ALTA' | null;
    locomotiveNumber?: number | string | null;
    viaOrigen?: { nombre?: string | null } | null;
    viaDestino?: { nombre?: string | null } | null;
    lavado?: boolean;
    torno?: boolean;
    estado?: string | null;
    instrucciones?: string | null;
  };
}

export interface InfoExtra {
  empresa: { id: number; nombre: string };
  movimiento: {
    id?: number;
    viaOrigen: { nombre: string };
    viaDestino: { nombre: string | null };
    lavado: boolean;
    torno: boolean;
    estado?: string | null;
    prioridad?: 'BAJA' | 'MEDIA' | 'ALTA' | null;
    locomotiveNumber?: number | string | null;
  };
}

export interface User {
  empresaId: number | null;
  token?: string | null;
}

type Grouped = Record<number, Ronda[]>;

/* =======================
   AUTH + FETCH (BFF)
   ======================= */

/** Build URL dentro del BFF */
function bffUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function appUrl(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

/** fetch autenticado vía BFF; la credencial nunca entra a JavaScript del navegador. */
async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  return fetch(bffUrl(path), {
    ...init,
    headers,
    credentials: 'include', // MUY importante para cookie
    cache: 'no-store',
  });
}

async function appFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  return fetch(appUrl(path), {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
}

async function getAppJson<T>(path: string): Promise<T> {
  const r = await appFetch(path, { method: 'GET' });
  if (r.status === 401) throw new Error('401');
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(txt || `${r.status} ${r.statusText}`);
  }
  const raw = await r.json();
  return (raw && typeof raw === 'object' && 'data' in raw) ? (raw.data as T) : (raw as T);
}

/** PATCH con fallbacks que devuelve JSON (o null si vacío) */
async function patchJsonWithFallbacks<T = unknown>(paths: string[], body: unknown): Promise<T> {
  let lastText = '';
  for (const p of paths) {
    try {
      const r = await bffFetch(p, { method: 'PATCH', body: JSON.stringify(body) });
      const txt = await r.text();
      if (r.status === 401) throw new Error('401');
      if (!r.ok) {
        lastText = txt || `${r.status} ${r.statusText}`;
        continue;
      }
      if (!txt) return null as unknown as T;
      const raw = JSON.parse(txt);
      return (raw && typeof raw === 'object' && 'data' in raw) ? (raw.data as T) : (raw as T);
    } catch (e: unknown) {
      lastText = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastText || 'No se pudo completar la operación');
}

async function postClienteRondas<T = unknown>(body: unknown): Promise<T> {
  const r = await appFetch('/api/cliente/rondas', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (r.status === 401) throw new Error('401');
  if (!r.ok) {
    let message = txt;
    try {
      const json = JSON.parse(txt);
      message = json?.message || json?.error || txt;
    } catch { }
    throw new Error(message || `${r.status} ${r.statusText}`);
  }
  invalidateCachedJson('/api/cliente/rondas');
  invalidateCachedJson('/movimientos');
  if (!txt) return null as T;
  const raw = JSON.parse(txt);
  return (raw && typeof raw === 'object' && 'data' in raw) ? (raw.data as T) : (raw as T);
}

function readCookieNumber(names: string[]): number | null {
  if (typeof document === 'undefined') return null;
  for (const name of names) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    const n = Number(match ? decodeURIComponent(match[1]) : null);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function getClientEmpresaIdSafe(): number | null {
  const fromCookie = readCookieNumber(['empresaId', 'empresald', 'empresaID']);
  if (fromCookie) return fromCookie;
  try {
    const direct = Number(localStorage.getItem('empresaId'));
    if (Number.isFinite(direct) && direct > 0) return direct;
    const uStr = localStorage.getItem('user');
    if (uStr) {
      const u = JSON.parse(uStr);
      const nested = Number(u?.empresaId ?? u?.empresa?.id);
      if (Number.isFinite(nested) && nested > 0) return nested;
    }
  } catch { }
  return null;
}

function movementTitle(movimientoId?: number, locomotiveNumber?: number | string | null) {
  if (locomotiveNumber != null && String(locomotiveNumber).trim()) return `Locomotora ${locomotiveNumber}`;
  if (movimientoId) return `Movimiento #${movimientoId}`;
  return 'Movimiento';
}

function normalizeRonda(raw: Ronda): Ronda {
  const movimientoId = Number(raw.movimiento?.id ?? raw.movimientoId ?? NaN) || undefined;
  const locomotiveNumber = raw.movimiento?.locomotiveNumber ?? null;
  const folioLocalidad = Number(raw.movimiento?.folioLocalidad ?? NaN) || null;
  const folioLocalidadLabel =
    raw.movimiento?.folioLocalidadLabel ?? (folioLocalidad ? `#${folioLocalidad}` : null);
  const movimientoTitle = folioLocalidadLabel
    ? `Movimiento ${folioLocalidadLabel}`
    : movementTitle(movimientoId, locomotiveNumber);
  return {
    ...raw,
    movimientoId: raw.movimientoId ?? movimientoId ?? null,
    movimiento: {
      ...raw.movimiento,
      id: movimientoId,
      idTecnico: raw.movimiento?.idTecnico ?? movimientoId ?? null,
      folioLocalidad,
      folioLocalidadLabel,
      title: raw.movimiento?.title ?? movimientoTitle,
      description: raw.movimiento?.description ?? raw.movimiento?.instrucciones ?? undefined,
      locomotiveNumber,
      prioridad: raw.movimiento?.prioridad ?? null,
      lavado: Boolean(raw.movimiento?.lavado),
      torno: Boolean(raw.movimiento?.torno),
      estado: raw.movimiento?.estado ?? null,
    },
  };
}

function infoFromRonda(ronda: Ronda): InfoExtra {
  return {
    empresa: {
      id: Number(ronda.empresa?.id ?? 0),
      nombre: ronda.empresa?.nombre ?? '—',
    },
    movimiento: {
      id: ronda.movimiento?.id,
      viaOrigen: { nombre: ronda.movimiento?.viaOrigen?.nombre ?? '—' },
      viaDestino: { nombre: ronda.movimiento?.viaDestino?.nombre ?? null },
      lavado: Boolean(ronda.movimiento?.lavado),
      torno: Boolean(ronda.movimiento?.torno),
      estado: ronda.movimiento?.estado ?? null,
      prioridad: ronda.movimiento?.prioridad ?? null,
      locomotiveNumber: ronda.movimiento?.locomotiveNumber ?? null,
    },
  };
}

/* =======================
   API públicas del hook
   ======================= */

type RondaMutationOptions = { sandbox?: boolean };

/** Swap de movimientos entre dos rondas (ruta oficial del backend) */
export async function apiSwapMovimientos(
  rondaAId: number | string,
  rondaBId: number | string,
  localidadId?: number | string,
  options: RondaMutationOptions = {},
) {
  if (options.sandbox || isTrainingRoundId(rondaAId) || isTrainingRoundId(rondaBId)) {
    return { sandbox: true };
  }
  return postClienteRondas({ action: 'swap', rondaAId, rondaBId, localidadId });
}

/** Cancela un movimiento y lo saca de su ronda (ruta oficial del backend) */
export async function apiCancelarMovimiento(
  movimientoId: number,
  razon?: string,
  localidadId?: number | string,
  options: RondaMutationOptions = {},
) {
  if (options.sandbox || isTrainingMovementId(movimientoId)) {
    return { sandbox: true };
  }
  return postClienteRondas({
    action: 'cancel',
    movimientoId,
    razon: razon ?? 'Cancelado por cliente',
    localidadId,
  });
}

/** Reordena una ronda/movimiento sin intercambiar contenido. Usado por Torreon. */
export async function apiOrdenMovimiento(
  rondaId: number | string,
  orden: number,
  localidadId?: number | string,
  options: RondaMutationOptions = {},
) {
  if (options.sandbox || isTrainingRoundId(rondaId)) {
    return { sandbox: true };
  }
  return postClienteRondas({ action: 'orden', id: rondaId, orden, localidadId });
}


/* ==============================
   Hook principal de datos (WEB)
   ============================== */
export const useRondaData = (localidadId: number, onClose: () => void) => {
  const [user, setUser] = useState<User>({ empresaId: null, token: null });
  const [list, setList] = useState<Ronda[]>([]);
  const [infoMap, setInfoMap] = useState<Record<number, InfoExtra>>({});
  const [loading, setLoading] = useState(true);
  const [groupedByRonda, setGroupedByRonda] = useState<Grouped>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        const empresaId = getClientEmpresaIdSafe();

        if (mounted) setUser({ empresaId });

        // 1) Rondas pendientes por localidad, ya filtradas por empresa en servidor si el rol es CLIENTE.
        const query = new URLSearchParams({
          localidadId: String(localidadId),
          estado: 'pendientes',
          entity: 'movimientos',
        });
        const rondas = await getAppJson<Ronda[]>(`/api/cliente/rondas?${query.toString()}`);

        const propias = (rondas || [])
          .map(normalizeRonda)
          .sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden);

        const extra: Record<number, InfoExtra> = {};
        propias.forEach((r) => {
          extra[r.id] = infoFromRonda(r);
        });

        // 2) Agrupar por rondaNumero
        const grouped: Grouped = {};
        propias.forEach((r) => {
          if (!grouped[r.rondaNumero]) grouped[r.rondaNumero] = [];
          grouped[r.rondaNumero].push(r);
        });

        if (!mounted) return;
        setInfoMap(extra);
        setList(propias);
        setGroupedByRonda(grouped);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('401')) {
          alert('Sesión expirada. Inicia sesión nuevamente.');
        } else {
          alert('No se pudieron cargar las rondas. ' + msg);
        }
        onClose?.();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [localidadId, onClose]);

  // Helpers de orden (si usas subir/bajar más adelante)
  const swapOrderLocal = useCallback(
    (rondaId: number, i: number, j: number) => {
      setGroupedByRonda((prev) => {
        const items = [...(prev[rondaId] || [])];
        if (i < 0 || j < 0 || i >= items.length || j >= items.length) return prev;

        const a = { ...items[i] };
        const b = { ...items[j] };
        const tmpOrden = a.orden;
        a.orden = b.orden;
        b.orden = tmpOrden;
        [items[i], items[j]] = [b, a];

        const next = { ...prev, [rondaId]: items };
        return next;
      });

      setList((prev) => {
        const copy = [...prev];
        const aId = groupedByRonda[rondaId]?.[i]?.id;
        const bId = groupedByRonda[rondaId]?.[j]?.id;
        const ai = copy.findIndex((x) => x.id === aId);
        const bi = copy.findIndex((x) => x.id === bId);
        if (ai !== -1 && bi !== -1) {
          const tmp = copy[ai].orden;
          copy[ai].orden = copy[bi].orden;
          copy[bi].orden = tmp;
        }
        return copy.sort((x, y) => x.rondaNumero - y.rondaNumero || x.orden - y.orden);
      });
    },
    [groupedByRonda]
  );

  const persistOrden = useCallback(
    async (aId: number, aOrden: number, bId: number, bOrden: number) => {
      // Intentamos PATCH directo a /rondas/:id con el nuevo orden
      // Si el backend sigue REST standard, esto debería actualizar el campo.
      await Promise.all([
        patchJsonWithFallbacks([`/rondas/${aId}`], { orden: aOrden }),
        patchJsonWithFallbacks([`/rondas/${bId}`], { orden: bOrden }),
      ]);
    },
    []
  );

  return {
    user,
    list,
    infoMap,
    loading,
    groupedByRonda,
    setGroupedByRonda,
    setList,
    swapOrderLocal,
    persistOrden,
  };
};
