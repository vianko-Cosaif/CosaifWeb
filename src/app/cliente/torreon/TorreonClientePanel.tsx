"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ARRASTRE_MAX_CAPACITY,
  ARRASTRE_MIN_VAGONES,
  arrastreVagonCapacity,
  buildArrastreFolio,
  buildDailyCounters,
  type Arrastre,
  type IncidenteArrastre,
  type VagonArrastre,
} from "@/features/torreon/arrastres";
import {
  CrearView,
  DashboardView,
  EditVagonModal,
  IncidentesView,
  MovimientosView,
  arrastreMatchesSearch,
  dateKey,
  isClosed,
  makeVagonDraft,
  normalizeArray,
  parseErrorMessage,
  isArrastreEditable,
  statusText,
  type ActionPayload,
  type Ambito,
  type ClienteArrastreIncidentRow,
  type EditVagonDraft,
  type OperationalVia,
  type TorreonPanelView,
  type VagonDraft,
} from "@/features/torreon/cliente";
import { useRealtimeBoardRefresh } from "@/app/hooks/useRealtimeBoardRefresh";
import { isTorreonArrastreEvent, realtimeArrastreSnapshot } from "@/features/torreon/realtime";
import { canViewTorreonArrastreRole, normalizeRoleName } from "@/lib/torreonLocalidad";
import TorreonIncidentDetailModal, { type TorreonIncidentDetail } from "@/app/coordinador/torreon/TorreonIncidentDetailModal";

export type { TorreonPanelView } from "@/features/torreon/cliente";

type TorreonClientePanelProps = {
  localidadId: number;
  empresaId: number | null;
  role: string;
  view?: TorreonPanelView;
};

function arrastreOrderValue(arrastre: Arrastre) {
  const value = Number(arrastre.ordenSolicitud);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function arrastreSolicitudTime(arrastre: Arrastre) {
  return Date.parse(String(arrastre.fechaSolicitud || arrastre.fechaInicio || "")) || 0;
}

function hasVagonEnProceso(arrastre: Arrastre) {
  return (arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
}

function canReorderSolicitud(arrastre: Arrastre) {
  return isArrastreEditable(arrastre.estado) && !hasVagonEnProceso(arrastre);
}

function hasOpenIncident(arrastre: Arrastre) {
  return (arrastre.incidentes || []).some((incident) => statusText(incident.estado) === "ABIERTO");
}

function hasPendingVagon(arrastre: Arrastre) {
  return (arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "PENDIENTE");
}

export default function TorreonClientePanel({ localidadId, role, view = "dashboard" }: TorreonClientePanelProps) {
  const router = useRouter();
  const normalizedRole = normalizeRoleName(role);
  const arrastreOnly = normalizedRole === "ARRASTRE_TORREON";
  const canViewArrastres = canViewTorreonArrastreRole(role);

  const [arrastres, setArrastres] = useState<Arrastre[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [draftVagones, setDraftVagones] = useState<VagonDraft[]>([makeVagonDraft(1)]);
  const [ambito, setAmbito] = useState<Ambito>("actuales");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [operationalVias, setOperationalVias] = useState<OperationalVia[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [editingVagon, setEditingVagon] = useState<EditVagonDraft | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<{
    incident: TorreonIncidentDetail;
    arrastreId: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (!canViewArrastres) {
        setArrastres([]);
        return;
      }

      const buildUrl = (vista: "activos" | "historial", pageSize: number) => {
        const params = new URLSearchParams({
          localidadId: String(localidadId),
          vista,
          page: "1",
          pageSize: String(pageSize),
          includeFotos: "0",
        });
        return `/api/cliente/torreon/arrastres?${params.toString()}`;
      };

      const [activeData, historyData] = await Promise.all([
        fetch(buildUrl("activos", 80), { cache: "no-store", credentials: "include" })
          .then((response) => response.json())
          .catch(() => []),
        fetch(buildUrl("historial", 40), { cache: "no-store", credentials: "include" })
          .then((response) => response.json())
          .catch(() => []),
      ]);

      setArrastres([
        ...normalizeArray<Arrastre>(activeData),
        ...normalizeArray<Arrastre>(historyData),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewArrastres, localidadId]);

  const refreshArrastreById = useCallback(async (arrastreId: number) => {
    if (!canViewArrastres || !Number.isFinite(arrastreId) || arrastreId <= 0) {
      await load(true);
      return;
    }

    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        localidadId: String(localidadId),
        id: String(arrastreId),
        includeFotos: "0",
      });
      const response = await fetch(`/api/cliente/torreon/arrastres?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("No se pudo refrescar arrastre");

      const data = await response.json();
      const next = (Array.isArray(data) ? data[0] : data) as Arrastre | null;
      if (!next?.id) {
        await load(true);
        return;
      }

      setArrastres((prev) => {
        const merged = new Map<number, Arrastre>();
        for (const item of prev) merged.set(item.id, item);
        merged.set(next.id, next);
        return Array.from(merged.values());
      });
    } catch {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [canViewArrastres, load, localidadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view !== "crear") return;
    let alive = true;
    setCatalogLoading(true);
    setCatalogError(null);

    fetch(`/api/torreon/arrastre-catalogo?localidadId=${localidadId}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(String(payload?.message || payload?.error || "No se pudo cargar el catálogo de vías de Arrastre"));
        return normalizeArray<{
          id?: number;
          numero?: number;
          nombre?: string;
          ocupada?: boolean;
          secciones?: Array<{ id?: number; numero?: number; nombre?: string | null; ocupada?: boolean }>;
        }>(payload);
      })
      .then((rows) => {
        if (!alive) return;
        const vias = rows
          .map((via) => ({
            id: Number(via.id),
            numero: Number(via.numero) || 0,
            nombre: String(via.nombre || `Vía ${via.numero || ""}`).trim(),
            ocupada: Boolean(via.ocupada),
            secciones: (Array.isArray(via.secciones) ? via.secciones : [])
              .map((section) => ({
                id: Number(section.id),
                numero: Number(section.numero) || 0,
                nombre: String(section.nombre || `Sección ${section.numero || ""}`).trim(),
                ocupada: Boolean(section.ocupada),
              }))
              .filter((section) => Number.isFinite(section.id) && section.id > 0),
          }))
          .filter((via) => Number.isFinite(via.id) && via.id > 0 && via.nombre)
          .sort((left, right) => left.numero - right.numero || left.nombre.localeCompare(right.nombre, "es-MX"));
        setOperationalVias(vias);
        if (!vias.length) setCatalogError("El administrador aún no ha configurado las vías del patio de Arrastre de Torreón.");
      })
      .catch((error) => {
        if (!alive) return;
        setOperationalVias([]);
        setCatalogError(error instanceof Error ? error.message : "No se pudo cargar el catálogo de vías de Arrastre");
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [localidadId, view]);

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: canViewArrastres,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    matchesEvent: isTorreonArrastreEvent,
    onRefresh: ({ event }) => {
      const snapshot = realtimeArrastreSnapshot(event);
      if (snapshot) {
        setArrastres((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)]);
        return;
      }
      const arrastreId = Number(event.arrastreId || 0);
      if (String(event.type || "").startsWith("torreon.arrastre") && arrastreId > 0) {
        return refreshArrastreById(arrastreId);
      }
      return load(true);
    },
  });

  const activeArrastres = useMemo(() => (
    arrastres
      .filter((arrastre) => !isClosed(arrastre.estado))
      .sort((a, b) => arrastreOrderValue(a) - arrastreOrderValue(b) || arrastreSolicitudTime(a) - arrastreSolicitudTime(b) || a.id - b.id)
  ), [arrastres]);
  const pastArrastres = useMemo(() => (
    arrastres
      .filter((arrastre) => isClosed(arrastre.estado))
      .sort((a, b) => arrastreSolicitudTime(b) - arrastreSolicitudTime(a) || b.id - a.id)
  ), [arrastres]);
  const orderedArrastres = useMemo(() => [...activeArrastres, ...pastArrastres], [activeArrastres, pastArrastres]);
  const dailyCounters = useMemo(() => buildDailyCounters(orderedArrastres), [orderedArrastres]);

  const visibleArrastres = useMemo(() => (
    (ambito === "actuales" ? activeArrastres : pastArrastres)
      .filter((arrastre) => !dateFilter || dateKey(arrastre.fechaSolicitud || arrastre.fechaInicio) === dateFilter)
      .filter((arrastre) => arrastreMatchesSearch(arrastre, search))
  ), [activeArrastres, ambito, dateFilter, pastArrastres, search]);
  const hasOpenIncidentInQueue = useMemo(() => activeArrastres.some(hasOpenIncident), [activeArrastres]);
  const incidentRows = useMemo<ClienteArrastreIncidentRow[]>(() => (
    arrastres.flatMap((arrastre) => (
      (arrastre.incidentes || []).map((incident) => ({
        arrastre,
        incident,
        dailyInfo: dailyCounters.get(arrastre.id),
      }))
    ))
  ), [arrastres, dailyCounters]);

  const stats = useMemo(() => {
    const vagones = arrastres.flatMap((arrastre) => arrastre.vagones || []);
    return {
      total: arrastres.length,
      solicitados: arrastres.filter((item) => statusText(item.estado) === "SOLICITADO").length,
      proceso: arrastres.filter((item) => statusText(item.estado) === "EN_PROCESO").length,
      detenidos: arrastres.filter((item) => statusText(item.estado) === "DETENIDO").length,
      concluidos: arrastres.filter((item) => statusText(item.estado) === "CONCLUIDO").length,
      pendientesVagon: vagones.filter((item) => ["PENDIENTE", "EN_PROCESO", "BLOQUEADO"].includes(statusText(item.estado))).length,
    };
  }, [arrastres]);

  const draftCapacity = useMemo(() => (
    draftVagones.reduce((total, vagon) => total + arrastreVagonCapacity(vagon.carga), 0)
  ), [draftVagones]);

  function updateDraftVagon(tempId: number, patch: Partial<VagonDraft>) {
    setDraftVagones((prev) => {
      const next = prev.map((vagon) => vagon.tempId === tempId ? { ...vagon, ...patch } : vagon);
      const nextCapacity = next.reduce((total, vagon) => total + arrastreVagonCapacity(vagon.carga), 0);
      return nextCapacity <= ARRASTRE_MAX_CAPACITY ? next : prev;
    });
  }

  function addDraftVagon() {
    setDraftVagones((prev) => {
      const currentCapacity = prev.reduce((total, vagon) => total + arrastreVagonCapacity(vagon.carga), 0);
      if (prev.length >= ARRASTRE_MAX_CAPACITY || currentCapacity >= ARRASTRE_MAX_CAPACITY) return prev;
      const nextId = Math.max(0, ...prev.map((vagon) => vagon.tempId)) + 1;
      return [...prev, makeVagonDraft(nextId)];
    });
  }

  function removeDraftVagon(tempId: number) {
    setDraftVagones((prev) => prev.length === 1 ? prev : prev.filter((vagon) => vagon.tempId !== tempId));
  }

  function moveDraftVagon(tempId: number, direction: "up" | "down") {
    setDraftVagones((prev) => {
      const index = prev.findIndex((vagon) => vagon.tempId === tempId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function routePatchFrom(vagon: VagonDraft) {
    return {
      viaOrigenId: vagon.viaOrigenId,
      seccionOrigenId: vagon.seccionOrigenId,
      viaId: vagon.viaId,
      seccionId: vagon.seccionId,
    };
  }

  function usePreviousRoute(tempId: number) {
    setDraftVagones((prev) => {
      const index = prev.findIndex((vagon) => vagon.tempId === tempId);
      if (index <= 0) return prev;
      const patch = routePatchFrom(prev[index - 1]);
      return prev.map((vagon) => vagon.tempId === tempId ? { ...vagon, ...patch } : vagon);
    });
  }

  function copyRouteToAll(tempId: number) {
    setDraftVagones((prev) => {
      const source = prev.find((vagon) => vagon.tempId === tempId);
      if (!source) return prev;
      const patch = routePatchFrom(source);
      return prev.map((vagon) => vagon.tempId === tempId ? vagon : { ...vagon, ...patch });
    });
  }

  function openEditVagon(arrastre: Arrastre, vagon: VagonArrastre) {
    if (!isArrastreEditable(arrastre.estado)) {
      setMessage({ type: "error", text: `Solo puedes editar arrastres solicitados o detenidos sin vagon en proceso. Estado actual: ${statusText(arrastre.estado)}` });
      return;
    }
    if (statusText(vagon.estado) === "EN_PROCESO") {
      setMessage({ type: "error", text: "No se puede editar un vagon en proceso" });
      return;
    }

    setEditingVagon({
      arrastreId: arrastre.id,
      vagonId: vagon.id,
      numeroVagon: vagon.numeroVagon || "",
      carga: statusText(vagon.carga) === "LLENO" ? "LLENO" : "VACIO",
      viaOrigenId: vagon.viaOrigenNombre || (vagon.viaOrigenId ? String(vagon.viaOrigenId) : ""),
      seccionOrigenId: vagon.seccionOrigenNombre || (vagon.seccionOrigenId ? String(vagon.seccionOrigenId) : ""),
      viaId: vagon.viaDestinoNombre || (vagon.viaId ? String(vagon.viaId) : ""),
      seccionId: vagon.seccionDestinoNombre || (vagon.seccionId ? String(vagon.seccionId) : ""),
    });
  }

  function updateEditingVagon(patch: Partial<EditVagonDraft>) {
    setEditingVagon((current) => current ? { ...current, ...patch } : current);
  }

  async function submitVagonEdit() {
    if (!editingVagon) return;
    setMessage(null);

    const numeroVagon = editingVagon.numeroVagon.trim();
    if (!numeroVagon) {
      setMessage({ type: "error", text: "El número de vagón es obligatorio" });
      return;
    }

    const viaOrigen = editingVagon.viaOrigenId?.trim() || "";
    const seccionOrigen = editingVagon.seccionOrigenId?.trim() || "";
    const viaDestino = editingVagon.viaId.trim();
    const seccionDestino = editingVagon.seccionId.trim();
    if (!viaOrigen || !seccionOrigen || !viaDestino || !seccionDestino) {
      setMessage({ type: "error", text: "Origen y destino deben tener via/seccion" });
      return;
    }

    const arrastre = arrastres.find((item) => item.id === editingVagon.arrastreId);
    if (arrastre && !isArrastreEditable(arrastre.estado)) {
      setMessage({ type: "error", text: `Solo puedes editar arrastres solicitados o detenidos sin vagon en proceso. Estado actual: ${statusText(arrastre.estado)}` });
      return;
    }

    const capacidad = arrastre?.vagones?.reduce((total, vagon) => {
      const carga = vagon.id === editingVagon.vagonId ? editingVagon.carga : statusText(vagon.carga);
      return total + (carga === "LLENO" ? 2 : 1);
    }, 0) ?? 0;
    if (capacidad > 8) {
      setMessage({ type: "error", text: "Capacidad excedida: lleno cuenta 2, vacio cuenta 1, maximo 8" });
      return;
    }

    const actionKey = `edit:${editingVagon.arrastreId}:${editingVagon.vagonId}`;
    setBusyAction(actionKey);

    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EDITAR_VAGON",
          arrastreId: editingVagon.arrastreId,
          vagonId: editingVagon.vagonId,
          numeroVagon,
          carga: editingVagon.carga,
          viaOrigen,
          seccionOrigen,
          viaDestino,
          seccionDestino,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo editar el vagon"));

      setEditingVagon(null);
      setMessage({ type: "ok", text: "Vagon actualizado" });
      await load(true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo editar el vagon" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitArrastre() {
    setMessage(null);

    const movimiento = instrucciones.trim();
    if (movimiento.length < 3) {
      setMessage({ type: "error", text: "Describe el movimiento u operacion del arrastre" });
      return;
    }

    if (draftVagones.length < ARRASTRE_MIN_VAGONES) {
      setMessage({ type: "error", text: "Agrega al menos un vagón" });
      return;
    }

    const vagones = draftVagones.map((vagon) => {
      const viaOrigen = operationalVias.find((via) => via.id === Number(vagon.viaOrigenId));
      const seccionOrigen = viaOrigen?.secciones.find((section) => section.id === Number(vagon.seccionOrigenId));
      const viaDestino = operationalVias.find((via) => via.id === Number(vagon.viaId));
      const seccionDestino = viaDestino?.secciones.find((section) => section.id === Number(vagon.seccionId));
      return {
        numeroVagon: vagon.numeroVagon.trim(),
        carga: vagon.carga,
        viaOrigenId: viaOrigen?.id,
        seccionOrigenId: seccionOrigen?.id,
        viaId: viaDestino?.id,
        seccionId: seccionDestino?.id,
        viaOrigenNombre: viaOrigen?.nombre,
        seccionOrigenNombre: seccionOrigen?.nombre,
        viaDestinoNombre: viaDestino?.nombre,
        seccionDestinoNombre: seccionDestino?.nombre,
      };
    });

    if (vagones.some((vagon) => !vagon.numeroVagon)) {
      setMessage({ type: "error", text: "Captura el número de cada vagón antes de continuar." });
      return;
    }

    const normalizedNumbers = vagones.map((vagon) => vagon.numeroVagon.toLocaleUpperCase("es-MX"));
    if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
      setMessage({ type: "error", text: "No repitas el mismo número de vagón dentro de la solicitud." });
      return;
    }

    if (vagones.some((vagon) => (
      !vagon.viaOrigenId ||
      !vagon.seccionOrigenId ||
      !vagon.viaId ||
      !vagon.seccionId
    ))) {
      setMessage({ type: "error", text: "Selecciona origen y destino del catálogo exclusivo del patio de Arrastre." });
      return;
    }

    const capacidad = vagones.reduce((total, vagon) => total + arrastreVagonCapacity(vagon.carga), 0);
    if (capacidad > ARRASTRE_MAX_CAPACITY) {
      setMessage({ type: "error", text: "Capacidad excedida: lleno cuenta 2, vacío cuenta 1, máximo 8" });
      return;
    }

    setBusyAction("crear");
    try {
      const response = await fetch("/api/cliente/torreon/arrastres", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localidadId, instrucciones: movimiento, vagones }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo crear el arrastre"));

      setInstrucciones("");
      setDraftVagones([makeVagonDraft(1)]);
      setMessage({ type: "ok", text: "Arrastre creado" });
      router.push("/cliente/torreon/movimientos");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo crear el arrastre" });
    } finally {
      setBusyAction(null);
    }
  }

  async function reorderVagon(arrastre: Arrastre, vagon: VagonArrastre, direction: "up" | "down") {
    if (!isArrastreEditable(arrastre.estado)) {
      setMessage({ type: "error", text: `Solo puedes reordenar arrastres solicitados o detenidos sin vagon en proceso. Estado actual: ${statusText(arrastre.estado)}` });
      return;
    }

    const vagones = [...(arrastre.vagones || [])].sort((left, right) => (left.orden ?? 0) - (right.orden ?? 0));
    const index = vagones.findIndex((item) => item.id === vagon.id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= vagones.length) return;
    if (statusText(vagones[index].estado) === "EN_PROCESO" || statusText(vagones[nextIndex].estado) === "EN_PROCESO") {
      setMessage({ type: "error", text: "No puedes mover un vagon que esta en proceso ni intercambiarlo con uno en proceso" });
      return;
    }

    [vagones[index], vagones[nextIndex]] = [vagones[nextIndex], vagones[index]];
    await runAction({
      action: "REORDENAR_VAGONES",
      arrastreId: arrastre.id,
      vagonIds: vagones.map((item) => item.id),
    }, (current) => current.map((item) => item.id === arrastre.id
      ? { ...item, vagones: vagones.map((vagon, orden) => ({ ...vagon, orden: orden + 1 })) }
      : item));
  }

  async function reorderSolicitud(arrastre: Arrastre, direction: "up" | "down") {
    if (!canReorderSolicitud(arrastre)) {
      setMessage({ type: "error", text: `Solo puedes reordenar solicitudes solicitadas o detenidas sin vagones en proceso. Estado actual: ${statusText(arrastre.estado)}` });
      return;
    }

    const solicitudes = activeArrastres.filter(canReorderSolicitud);
    const index = solicitudes.findIndex((item) => item.id === arrastre.id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= solicitudes.length) return;

    [solicitudes[index], solicitudes[nextIndex]] = [solicitudes[nextIndex], solicitudes[index]];
    await runAction({
      action: "REORDENAR_SOLICITUDES",
      arrastreId: arrastre.id,
      arrastreIds: solicitudes.map((item) => item.id),
    }, (current) => current.map((item) => {
      const index = solicitudes.findIndex((solicitud) => solicitud.id === item.id);
      return index >= 0 ? { ...item, ordenSolicitud: index + 1 } : item;
    }));
  }

  async function prioritizeSolicitud(arrastre: Arrastre) {
    if (!hasOpenIncidentInQueue) {
      setMessage({ type: "error", text: "Solo puedes subir una solicitud al frente cuando existe un incidente abierto en la cola." });
      return;
    }
    if (!canReorderSolicitud(arrastre)) {
      setMessage({ type: "error", text: `Solo puedes subir solicitudes solicitadas o detenidas sin vagones en proceso. Estado actual: ${statusText(arrastre.estado)}` });
      return;
    }
    if (!hasPendingVagon(arrastre)) {
      setMessage({ type: "error", text: "La solicitud no tiene vagones pendientes disponibles para subir al frente." });
      return;
    }

    await runAction({
      action: "PRIORIZAR_SOLICITUD",
      arrastreId: arrastre.id,
    }, (current) => [
      { ...arrastre, ordenSolicitud: 1 },
      ...current.filter((item) => item.id !== arrastre.id).map((item, index) => ({ ...item, ordenSolicitud: index + 2 })),
    ]);
  }

  async function runAction(payload: ActionPayload, optimistic?: (current: Arrastre[]) => Arrastre[]) {
    setMessage(null);
    const actionKey = `${payload.arrastreId}:${payload.vagonId ?? payload.action}`;
    setBusyAction(actionKey);
    const previous = arrastres;
    if (optimistic) setArrastres(optimistic);

    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo operar el arrastre"));

      setMessage({ type: "ok", text: "Operacion aplicada" });
      await load(true);
    } catch (error) {
      if (optimistic) setArrastres(previous);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo operar el arrastre" });
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelArrastre(arrastre: Arrastre) {
    const motivo = window.prompt(`Motivo para cancelar el arrastre ID #${arrastre.id}`, "");
    if (motivo === null) return;
    await runAction({
      action: "CANCELAR",
      arrastreId: arrastre.id,
      motivo: motivo.trim() || undefined,
    }, (current) => current.map((item) => item.id === arrastre.id ? { ...item, estado: "CANCELADO" } : item));
  }

  function openIncident(incident: IncidenteArrastre, arrastre: Arrastre) {
    const arrastreId = arrastre.id;
    const title = `Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`;
    const subtitle = `Movimiento de arrastre #${arrastre.id}`;
    setSelectedIncident({
      incident,
      arrastreId,
      title,
      subtitle,
    });

    const incidentId = Number(incident.id);
    const currentFotos = Array.isArray(incident.fotos) ? incident.fotos.length : 0;
    const shouldLoadDetail = Number.isFinite(incidentId) && (currentFotos === 0 || (incident.fotosCount ?? 0) > currentFotos);
    if (!shouldLoadDetail) return;

    const params = new URLSearchParams({
      source: "torreon",
      tipo: "ARRASTRE",
      localidadId: String(localidadId),
    });
    fetch(`/api/incidentes/${incidentId}?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const record = payload && typeof payload === "object" && "data" in payload
          ? (payload as { data?: unknown }).data
          : payload;
        if (!record || typeof record !== "object") return;
        setSelectedIncident((current) => {
          if (!current || current.arrastreId !== arrastreId || Number(current.incident.id) !== incidentId) return current;
          return {
            ...current,
            incident: {
              ...current.incident,
              ...(record as TorreonIncidentDetail),
            },
          };
        });
      })
      .catch(() => undefined);
  }

  async function resolveIncident(arrastreId: number, incidenteId: number, solucion: string) {
    const actionKey = `resolve:${arrastreId}:${incidenteId}`;
    setBusyAction(actionKey);
    setMessage(null);

    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESOLVER_INCIDENTE",
          arrastreId,
          incidenteId,
          solucion,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo resolver el incidente"));

      setSelectedIncident(null);
      setMessage({ type: "ok", text: "Incidente resuelto y bloqueo liberado" });
      await load(true);
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo resolver el incidente";
      setMessage({ type: "error", text });
      throw error;
    } finally {
      setBusyAction(null);
    }
  }

  if (arrastreOnly && !canViewArrastres) return null;

  const feedback = message && (
    <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
      message.type === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-rose-200 bg-rose-50 text-rose-800"
    }`}>
      {message.text}
    </div>
  );

  return (
    <section className="w-full px-3 py-4 sm:px-5">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        {view === "dashboard" && (
          <DashboardView
            realtimeStatus={realtimeStatus}
            feedback={feedback}
            stats={stats}
            activeArrastres={activeArrastres}
            dailyCounters={dailyCounters}
            loading={loading}
            refreshing={refreshing}
            audience={arrastreOnly ? "arrastre" : "cliente"}
            onMovimientos={() => router.push("/cliente/torreon/movimientos")}
            onCrear={() => router.push("/cliente/torreon/crear")}
            onRefresh={() => load(true)}
            onPrioritizeSolicitud={prioritizeSolicitud}
            onIncidentSelect={openIncident}
          />
        )}

        {view === "movimientos" && (
          <MovimientosView
            feedback={feedback}
            ambito={ambito}
            search={search}
            dateFilter={dateFilter}
            refreshing={refreshing}
            loading={loading}
            visibleArrastres={visibleArrastres}
            activeCount={activeArrastres.length}
            pastCount={pastArrastres.length}
            busyAction={busyAction}
            dailyCounters={dailyCounters}
            canPrioritizeByIncident={hasOpenIncidentInQueue}
            onAmbito={setAmbito}
            onSearch={setSearch}
            onDateFilter={setDateFilter}
            onRefresh={() => load(true)}
            onNuevo={() => router.push("/cliente/torreon/crear")}
            onEditVagon={openEditVagon}
            onPrioritizeSolicitud={prioritizeSolicitud}
            onReorderVagon={reorderVagon}
            onReorderSolicitud={reorderSolicitud}
            onCancel={cancelArrastre}
            onIncidentSelect={openIncident}
          />
        )}

        {view === "crear" && (
          <CrearView
            feedback={feedback}
            refreshing={refreshing}
            instrucciones={instrucciones}
            draftVagones={draftVagones}
            draftCapacity={draftCapacity}
            busyAction={busyAction}
            vias={operationalVias}
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            onRefresh={() => load(true)}
            onGoMovimientos={() => router.push("/cliente/torreon/movimientos")}
            onInstruccionesChange={setInstrucciones}
            onUpdateVagon={updateDraftVagon}
            onRemoveVagon={removeDraftVagon}
            onMoveVagon={moveDraftVagon}
            onUsePreviousRoute={usePreviousRoute}
            onCopyRouteToAll={copyRouteToAll}
            onAddVagon={addDraftVagon}
            onSubmit={submitArrastre}
          />
        )}

        {view === "incidentes" && (
          <IncidentesView
            feedback={feedback}
            rows={incidentRows}
            dailyCounters={dailyCounters}
            loading={loading}
            refreshing={refreshing}
            resolvingId={busyAction?.startsWith("resolve:") ? busyAction.replace("resolve:", "") : null}
            onRefresh={() => load(true)}
            onIncidentSelect={openIncident}
            onResolveClick={openIncident}
          />
        )}

        {editingVagon && (
          <EditVagonModal
            draft={editingVagon}
            busy={busyAction === `edit:${editingVagon.arrastreId}:${editingVagon.vagonId}`}
            onChange={updateEditingVagon}
            onClose={() => setEditingVagon(null)}
            onSubmit={submitVagonEdit}
          />
        )}

        {selectedIncident ? (
          <TorreonIncidentDetailModal
            incident={selectedIncident.incident}
            title={selectedIncident.title}
            subtitle={selectedIncident.subtitle}
            resolving={busyAction === `resolve:${selectedIncident.arrastreId}:${selectedIncident.incident.id}`}
            onResolve={(solucion) => resolveIncident(selectedIncident.arrastreId, Number(selectedIncident.incident.id), solucion)}
            onClose={() => setSelectedIncident(null)}
          />
        ) : null}
      </div>
    </section>
  );
}
