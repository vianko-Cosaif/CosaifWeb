import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, SECC_BASE, type Empresa, type Localidad, type Seccion, type Via } from "../movimientos.shared";
import { cachedFetchJson } from "@/lib/clientRequestCache";

/**
 * MODULO: useCrearMovimientoCatalogos
 *
 * Responsabilidad:
 * - Cargar catalogos base (empresas/localidades).
 * - Cargar vias por localidad seleccionada.
 * - Cargar secciones por via con cache en memoria.
 *
 * Este archivo NO:
 * - Maneja validaciones del wizard.
 * - Envia payload de movimiento.
 * - Gestiona draft/outbox.
 */

type ViaDTO = { id?: unknown; nombre?: unknown };
type ViaEnvelope = { data?: unknown; vias?: unknown; items?: unknown };

function extractViaRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const envelope = raw as ViaEnvelope;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.vias)) return envelope.vias;
  if (Array.isArray(envelope.items)) return envelope.items;
  return [];
}

function normalizeVias(raw: unknown): Via[] {
  return extractViaRows(raw)
    .map((value) => {
      const dto = value as ViaDTO;
      const id = Number(dto.id);
      const nombre = String(dto.nombre ?? "").trim();
      return Number.isInteger(id) && id > 0 && nombre ? { id, nombre } : null;
    })
    .filter((via): via is Via => via !== null)
    .sort((a, b) => {
      const numA = Number(a.nombre);
      const numB = Number(b.nombre);

      if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
      if (!Number.isNaN(numA)) return -1;
      if (!Number.isNaN(numB)) return 1;
      return a.nombre.localeCompare(b.nombre, "es", { numeric: true });
    });
}

function viasLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/401|no autenticado|token revocado|token vencido/i.test(message)) {
    return "Tu sesión venció. Vuelve a iniciar sesión para cargar las vías.";
  }
  if (/403|contexto de sesión|localidad asignada/i.test(message)) {
    return "Tu sesión no tiene acceso a las vías de esta localidad.";
  }
  return "No se pudieron cargar las vías de la localidad.";
}

const TRAINING_EMPRESAS: Empresa[] = [
  { id: 91_001, nombre: "Empresa de capacitación" },
];
const TRAINING_LOCALIDADES: Localidad[] = [
  { id: 1, nombre: "Localidad de capacitación", estado: "ACTIVA" },
];
const TRAINING_VIAS: Via[] = [
  { id: 91_101, nombre: "Vía 1 · capacitación" },
  { id: 91_102, nombre: "Vía 2 · capacitación" },
  { id: 91_103, nombre: "Vía 3 · capacitación" },
  { id: 91_104, nombre: "Vía 4 · capacitación" },
];

function trainingSections(viaId: number): Seccion[] {
  return [1, 2, 3].map((numero) => ({
    id: viaId * 10 + numero,
    numero,
    nombre: `Sección ${numero}`,
    ocupada: false,
    movimientoId: null,
  }));
}

/**
 * Hook de datos referenciales para el flujo de creacion.
 *
 * Entrada:
 * - selectedLocalityId: localidad activa del formulario.
 *
 * Salida:
 * - catalogos y funciones de carga incremental.
 */
export function useCrearMovimientoCatalogos(
  selectedLocalityId?: number | null,
  { sandbox = false }: { sandbox?: boolean } = {},
) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [viasLoading, setViasLoading] = useState(false);
  const [viasError, setViasError] = useState<string | null>(null);
  const [sectionsByVia, setSectionsByVia] = useState<Record<number, Seccion[]>>({});
  const [secLoading, setSecLoading] = useState<Record<number, boolean>>({});
  const viaRequestRef = useRef(0);

  /** Carga catalogos de empresas y localidades. */
  const loadCatalogos = useCallback(async () => {
    if (sandbox) {
      setEmpresas(TRAINING_EMPRESAS);
      setLocalidades(TRAINING_LOCALIDADES);
      return { eList: TRAINING_EMPRESAS, lList: TRAINING_LOCALIDADES };
    }
    const [e, l] = await Promise.all([
      cachedFetchJson<unknown>(`${API_BASE}/empresas`, {}, { ttlMs: 5 * 60_000 }).catch(() => []),
      cachedFetchJson<unknown>(`${API_BASE}/localidades`, {}, { ttlMs: 5 * 60_000 }).catch(() => []),
    ]);

    const eList: Empresa[] = Array.isArray(e) ? e : [];
    const lList: Localidad[] = Array.isArray(l) ? l : [];

    setEmpresas(eList);
    setLocalidades(lList);

    return { eList, lList };
  }, [sandbox]);

  /**
   * Carga vías según localidad seleccionada.
   *
   * El endpoint completo incluye relaciones e historiales y en producción puede
   * superar varios MB. El formulario sólo necesita id/nombre, por eso usa /lite.
   */
  const loadVias = useCallback(async (force = false) => {
    const requestId = ++viaRequestRef.current;
    const localidadId = Number(selectedLocalityId);

    if (sandbox) {
      setVias(selectedLocalityId ? TRAINING_VIAS : []);
      setViasLoading(false);
      setViasError(null);
      return;
    }
    if (!Number.isInteger(localidadId) || localidadId <= 0) {
      setVias([]);
      setViasLoading(false);
      setViasError(null);
      return;
    }

    setVias([]);
    setViasLoading(true);
    setViasError(null);

    try {
      const data = await cachedFetchJson<unknown>(
        `${API_BASE}/vias/localidad/${localidadId}/lite`,
        { credentials: "include" },
        { ttlMs: 5 * 60_000, force, timeoutMs: 12_000 }
      );
      if (requestId !== viaRequestRef.current) return;
      setVias(normalizeVias(data));
    } catch (error) {
      if (requestId !== viaRequestRef.current) return;
      setVias([]);
      setViasError(viasLoadError(error));
    } finally {
      if (requestId === viaRequestRef.current) setViasLoading(false);
    }
  }, [sandbox, selectedLocalityId]);

  useEffect(() => {
    void loadVias();
    return () => {
      viaRequestRef.current += 1;
    };
  }, [loadVias]);

  const reloadVias = useCallback(() => loadVias(true), [loadVias]);

  const secLoadingRef = useRef<Record<number, boolean>>({});

  /** Carga secciones por via con cache en memoria. */
  const ensureSections = useCallback(async (viaId: number) => {
    if (!viaId) return;
    if (sandbox) {
      setSectionsByVia((current) => (
        current[viaId] ? current : { ...current, [viaId]: trainingSections(viaId) }
      ));
      return;
    }
    if (secLoadingRef.current[viaId]) return;
    if (Array.isArray(sectionsByVia[viaId])) return;

    secLoadingRef.current[viaId] = true;
    setSecLoading((s) => ({ ...s, [viaId]: true }));

    try {
      const raw = await cachedFetchJson<{ secciones?: Seccion[] } | Seccion[]>(
        `${SECC_BASE}/via/${viaId}`,
        {},
        { ttlMs: 60_000 }
      );
      const arr: Seccion[] = Array.isArray(raw) ? raw : raw?.secciones ?? [];
      const ordered = arr.slice().sort((a, b) => a.numero - b.numero);
      setSectionsByVia((m) => ({ ...m, [viaId]: ordered }));
    } catch {
      setSectionsByVia((m) => ({ ...m, [viaId]: [] }));
    } finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [sandbox, sectionsByVia]);

  return {
    empresas,
    localidades,
    vias,
    viasLoading,
    viasError,
    sectionsByVia,
    secLoading,
    loadCatalogos,
    reloadVias,
    ensureSections,
  };
}
