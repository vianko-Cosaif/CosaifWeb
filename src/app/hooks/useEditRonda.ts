// /hooks/useEditRondaWeb.ts
'use client';

import { useEffect, useState, useCallback } from 'react';

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
  movimiento: {
    id?: number;
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

/** Igual que tu hook de incidentes: lee token de cookie "token" */
function getAuthHeadersFromCookie(): HeadersInit {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? { Authorization: `Bearer ${decodeURIComponent(match[1])}` } : {};
}

/** Build URL dentro del BFF */
function bffUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** fetch autenticado vía BFF: manda cookie + (opcional) Authorization */
async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeadersFromCookie(),
    ...(init.headers || {}),
  };
  return fetch(bffUrl(path), {
    ...init,
    headers,
    credentials: 'include', // MUY importante para cookie
    cache: 'no-store',
  });
}

/** Intenta varias rutas (fallbacks) y devuelve JSON desenvuelto ({success,data} | data) */
async function getJsonWithFallbacks<T>(paths: string[]): Promise<T> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const r = await bffFetch(p, { method: 'GET' });
      if (r.status === 401) throw new Error('401');
      if (!r.ok) {
        lastErr = new Error(`${r.status} ${r.statusText}`);
        continue;
      }
      const raw = await r.json();
      const data = (raw && typeof raw === 'object' && 'data' in raw) ? (raw.data as T) : (raw as T);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Error de red');
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
    } catch (e: any) {
      lastText = String(e?.message || e);
    }
  }
  throw new Error(lastText || 'No se pudo completar la operación');
}

/** (Opcional) PUT simple */
async function putJson(path: string, body: unknown) {
  const r = await bffFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  if (r.status === 401) throw new Error('401');
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(txt || `${r.status} ${r.statusText}`);
  }
  return r.text().then(t => (t ? JSON.parse(t) : null));
}

/* =======================
   API públicas del hook
   ======================= */

/** Swap de movimientos entre dos rondas (ruta oficial del backend) */
export async function apiSwapMovimientos(rondaAId: number | string, rondaBId: number | string) {
  return patchJsonWithFallbacks(
    [
      '/rondas/intercambiar-movimientos',         // RondaRoutes.ts
      // '/rondas/intercambiar',                   // por si existe alias en tu server
    ],
    { rondaAId, rondaBId }
  );
}

/** Cancela un movimiento y lo saca de su ronda (ruta oficial del backend) */
export async function apiCancelarMovimiento(movimientoId: number, razon?: string) {
  return patchJsonWithFallbacks(
    [
      `movimientos/movimientos/${movimientoId}/cancelar`,  // MovimientoRoutes.ts
      // '/movimientos/cancelar'                 // por si existiera alias legacy
    ],
    { razon: razon ?? 'Sin motivo' }
  );
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

        // Lee empresaId de localStorage si existe (no obligatorio)
        let empresaId: number | null = null;
        try {
          const uStr = localStorage.getItem('user');
          if (uStr) {
            const u = JSON.parse(uStr);
            empresaId = Number(u?.empresaId ?? null) || null;
          }
        } catch {}

        if (mounted) setUser({ empresaId });

        // 1) Rondas pendientes por localidad
        const rondas = await getJsonWithFallbacks<Ronda[]>([
          `/rondas/localidad/${localidadId}/estado/false`,
          // Si tienes otra ruta bff -> '/api/rondas/localidad/...', añádela arriba
        ]);

        // 2) Info adicional por ronda (ruta oficial + fallback legacy)
        const extra: Record<number, InfoExtra> = {};
        await Promise.all(
          (rondas || []).map(async (r) => {
            try {
              const info = await getJsonWithFallbacks<InfoExtra>([
                `/rondas/${r.id}/info`,                 // RondaRoutes.ts
                `/movimientos/ronda/${r.id}/info`,      // legacy (si existiera)
              ]);
              extra[r.id] = info;
            } catch {
              // sin info, no rompemos
            }
          })
        );

        // 3) Filtrar por empresa si la conocemos; si no, mostrar todo para no "romper"
        const propias = (rondas || [])
          .filter((r) => {
            if (!empresaId) return true;
            const empId = extra[r.id]?.empresa?.id ?? null;
            return empId === empresaId;
          })
          .sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden);

        // 4) Agrupar por rondaNumero
        const grouped: Grouped = {};
        propias.forEach((r) => {
          if (!grouped[r.rondaNumero]) grouped[r.rondaNumero] = [];
          grouped[r.rondaNumero].push(r);
        });

        if (!mounted) return;
        setInfoMap(extra);
        setList(propias);
        setGroupedByRonda(grouped);
      } catch (e: any) {
        const msg = String(e?.message || e);
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
      // SOLO si tu backend lo expone (no apareció en tu snippet, así que déjalo opcional)
      await Promise.all([
        putJson(`/rondas/${aId}/orden`, { orden: aOrden }),
        putJson(`/rondas/${bId}/orden`, { orden: bOrden }),
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
