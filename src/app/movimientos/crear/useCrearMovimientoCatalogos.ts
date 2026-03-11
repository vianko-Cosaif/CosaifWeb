import { useCallback, useEffect, useRef, useState } from "react";
import { Movimiento } from "../Movimiento";
import { API_BASE, SECC_BASE, type Empresa, type Localidad, type Seccion, type Via } from "../movimientos.shared";

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

type ViaDTO = { id: number; nombre: string };

/**
 * Hook de datos referenciales para el flujo de creacion.
 *
 * Entrada:
 * - selectedLocalityId: localidad activa del formulario.
 *
 * Salida:
 * - catalogos y funciones de carga incremental.
 */
export function useCrearMovimientoCatalogos(selectedLocalityId?: number | null) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [sectionsByVia, setSectionsByVia] = useState<Record<number, Seccion[]>>({});
  const [secLoading, setSecLoading] = useState<Record<number, boolean>>({});

  /** Carga catalogos de empresas y localidades. */
  const loadCatalogos = useCallback(async () => {
    const [e, l] = await Promise.all([
      Movimiento.fetchJSON(`${API_BASE}/empresas`).catch(() => []),
      Movimiento.fetchJSON(`${API_BASE}/localidades`).catch(() => []),
    ]);

    const eList: Empresa[] = Array.isArray(e) ? e : [];
    const lList: Localidad[] = Array.isArray(l) ? l : [];

    setEmpresas(eList);
    setLocalidades(lList);

    return { eList, lList };
  }, []);

  /** Carga vias segun localidad seleccionada. */
  useEffect(() => {
    (async () => {
      if (!selectedLocalityId) {
        setVias([]);
        return;
      }

      try {
        const data = await Movimiento.fetchJSON(`${API_BASE}/vias/localidad/${selectedLocalityId}`);
        const list: Via[] = Array.isArray(data)
          ? data.map((v) => {
            const dto = v as ViaDTO;
            return { id: Number(dto.id), nombre: String(dto.nombre) };
          })
          : [];

        list.sort((a, b) => {
          const numA = Number(a.nombre);
          const numB = Number(b.nombre);

          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          if (!isNaN(numA)) return -1;
          if (!isNaN(numB)) return 1;

          return String(a.nombre).localeCompare(String(b.nombre));
        });

        setVias(list);
      } catch {
        setVias([]);
      }
    })();
  }, [selectedLocalityId]);

  const secLoadingRef = useRef<Record<number, boolean>>({});

  /** Carga secciones por via con cache en memoria. */
  const ensureSections = useCallback(async (viaId: number) => {
    if (!viaId) return;
    if (secLoadingRef.current[viaId]) return;
    if (Array.isArray(sectionsByVia[viaId])) return;

    secLoadingRef.current[viaId] = true;
    setSecLoading((s) => ({ ...s, [viaId]: true }));

    try {
      const raw = await Movimiento.fetchJSON(`${SECC_BASE}/via/${viaId}`);
      const arr: Seccion[] = Array.isArray(raw) ? raw : raw?.secciones ?? [];
      const ordered = arr.slice().sort((a, b) => a.numero - b.numero);
      setSectionsByVia((m) => ({ ...m, [viaId]: ordered }));
    } catch {
      setSectionsByVia((m) => ({ ...m, [viaId]: [] }));
    } finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [sectionsByVia]);

  return {
    empresas,
    localidades,
    vias,
    sectionsByVia,
    secLoading,
    loadCatalogos,
    ensureSections,
  };
}
