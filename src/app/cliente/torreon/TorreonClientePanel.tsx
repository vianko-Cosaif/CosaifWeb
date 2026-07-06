"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildDailyCounters, type Arrastre, type VagonArrastre } from "@/features/torreon/arrastres";
import {
  CrearView,
  DashboardView,
  EditVagonModal,
  IncidentesView,
  MovimientosView,
  arrastreMatchesSearch,
  dateKey,
  emptyIncidentDraft,
  isClosed,
  makeVagonDraft,
  normalizeArray,
  parseErrorMessage,
  readFilesAsDataUrls,
  statusText,
  type ActionPayload,
  type Ambito,
  type EditVagonDraft,
  type IncidentDraft,
  type TorreonPanelView,
  type VagonDraft,
} from "@/features/torreon/cliente";
import { canViewTorreonArrastreRole, normalizeRoleName } from "@/lib/torreonLocalidad";

export type { TorreonPanelView } from "@/features/torreon/cliente";

type TorreonClientePanelProps = {
  localidadId: number;
  empresaId: number | null;
  role: string;
  view?: TorreonPanelView;
};

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
  const [incidentDrafts, setIncidentDrafts] = useState<Record<number, IncidentDraft>>({});
  const [ambito, setAmbito] = useState<Ambito>("actuales");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [editingVagon, setEditingVagon] = useState<EditVagonDraft | null>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = canViewArrastres
        ? await fetch(`/api/cliente/torreon/arrastres?localidadId=${localidadId}`, {
            cache: "no-store",
            credentials: "include",
          }).then((response) => response.json()).catch(() => [])
        : [];

      setArrastres(normalizeArray<Arrastre>(data));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewArrastres, localidadId]);

  useEffect(() => {
    load();
  }, [load]);

  const orderedArrastres = useMemo(() => (
    [...arrastres].sort((a, b) => {
      const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
      const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
      return bTime - aTime;
    })
  ), [arrastres]);

  const activeArrastres = useMemo(() => orderedArrastres.filter((arrastre) => !isClosed(arrastre.estado)), [orderedArrastres]);
  const pastArrastres = useMemo(() => orderedArrastres.filter((arrastre) => isClosed(arrastre.estado)), [orderedArrastres]);
  const dailyCounters = useMemo(() => buildDailyCounters(orderedArrastres), [orderedArrastres]);

  const visibleArrastres = useMemo(() => (
    (ambito === "actuales" ? activeArrastres : pastArrastres)
      .filter((arrastre) => !dateFilter || dateKey(arrastre.fechaSolicitud || arrastre.fechaInicio) === dateFilter)
      .filter((arrastre) => arrastreMatchesSearch(arrastre, search))
  ), [activeArrastres, ambito, dateFilter, pastArrastres, search]);

  const incidentRows = useMemo(() => (
    orderedArrastres
      .flatMap((arrastre) => (arrastre.incidentes || []).map((incidente) => {
        const vagon = (arrastre.vagones || []).find((item) => item.id === incidente.vagonId);
        return {
          arrastre,
          incidente,
          vagon,
          dailyInfo: dailyCounters.get(arrastre.id),
        };
      }))
      .filter(({ arrastre, incidente, vagon }) => {
        const incidentDate = incidente.fechaInicio || arrastre.fechaSolicitud || arrastre.fechaInicio;
        if (dateFilter && dateKey(incidentDate) !== dateFilter) return false;

        const query = search.trim().toLowerCase();
        if (!query) return true;

        return [
          arrastre.id,
          incidente.id,
          incidente.estado,
          incidente.motivo,
          incidente.solucion,
          vagon?.numeroVagon,
          vagon?.viaId,
          vagon?.seccionId,
          arrastre.instrucciones,
        ]
          .filter((item) => item != null)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
  ), [dailyCounters, dateFilter, orderedArrastres, search]);

  const nextVagones = useMemo(() => (
    activeArrastres.flatMap((arrastre) => (arrastre.vagones || [])
      .filter((vagon) => statusText(vagon.estado) !== "CONCLUIDO")
      .map((vagon) => ({ arrastre, vagon })))
      .slice(0, 10)
  ), [activeArrastres]);

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
    draftVagones.reduce((total, vagon) => total + (vagon.carga === "LLENO" ? 2 : 1), 0)
  ), [draftVagones]);

  function setIncidentDraft(arrastreId: number, draft: IncidentDraft) {
    setIncidentDrafts((prev) => ({ ...prev, [arrastreId]: draft }));
  }

  function updateDraftVagon(tempId: number, patch: Partial<VagonDraft>) {
    setDraftVagones((prev) => prev.map((vagon) => vagon.tempId === tempId ? { ...vagon, ...patch } : vagon));
  }

  function addDraftVagon() {
    setDraftVagones((prev) => {
      if (prev.length >= 8) return prev;
      const nextId = Math.max(0, ...prev.map((vagon) => vagon.tempId)) + 1;
      return [...prev, makeVagonDraft(nextId)];
    });
  }

  function removeDraftVagon(tempId: number) {
    setDraftVagones((prev) => prev.length === 1 ? prev : prev.filter((vagon) => vagon.tempId !== tempId));
  }

  function openEditVagon(arrastre: Arrastre, vagon: VagonArrastre) {
    if (statusText(vagon.estado) === "EN_PROCESO") {
      setMessage({ type: "error", text: "No se puede editar un vagon en proceso" });
      return;
    }

    setEditingVagon({
      arrastreId: arrastre.id,
      vagonId: vagon.id,
      numeroVagon: vagon.numeroVagon || "",
      carga: statusText(vagon.carga) === "LLENO" ? "LLENO" : "VACIO",
      viaId: String(vagon.viaId),
      seccionId: String(vagon.seccionId),
    });
  }

  function updateEditingVagon(patch: Partial<EditVagonDraft>) {
    setEditingVagon((current) => current ? { ...current, ...patch } : current);
  }

  async function submitVagonEdit() {
    if (!editingVagon) return;
    setMessage(null);

    const viaId = Number(editingVagon.viaId);
    const seccionId = Number(editingVagon.seccionId);
    if (!Number.isFinite(viaId) || viaId <= 0 || !Number.isFinite(seccionId) || seccionId <= 0) {
      setMessage({ type: "error", text: "Via y seccion deben ser validas" });
      return;
    }

    const arrastre = arrastres.find((item) => item.id === editingVagon.arrastreId);
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
          numeroVagon: editingVagon.numeroVagon.trim() || undefined,
          carga: editingVagon.carga,
          viaId,
          seccionId,
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

    const vagones = draftVagones.map((vagon) => ({
      numeroVagon: vagon.numeroVagon.trim() || undefined,
      carga: vagon.carga,
      viaId: Number(vagon.viaId),
      seccionId: Number(vagon.seccionId),
    }));

    if (vagones.some((vagon) => !Number.isFinite(vagon.viaId) || vagon.viaId <= 0 || !Number.isFinite(vagon.seccionId) || vagon.seccionId <= 0)) {
      setMessage({ type: "error", text: "Cada vagon necesita via y seccion" });
      return;
    }

    const capacidad = vagones.reduce((total, vagon) => total + (vagon.carga === "LLENO" ? 2 : 1), 0);
    if (capacidad > 8) {
      setMessage({ type: "error", text: "Capacidad excedida: lleno cuenta 2, vacio cuenta 1, maximo 8" });
      return;
    }

    setBusyAction("crear");
    try {
      const response = await fetch("/api/cliente/torreon/arrastres", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localidadId, instrucciones, vagones }),
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

  async function runAction(payload: ActionPayload) {
    setMessage(null);
    const actionKey = payload.action.includes("INCIDENTE")
      ? `incidente:${payload.arrastreId}`
      : `${payload.arrastreId}:${payload.vagonId ?? payload.action}`;
    setBusyAction(actionKey);

    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo operar el arrastre"));

      setIncidentDrafts((prev) => {
        const next = { ...prev };
        delete next[payload.arrastreId];
        return next;
      });
      setMessage({ type: "ok", text: "Operacion aplicada" });
      await load(true);
    } catch (error) {
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
    });
  }

  async function handleIncidentFiles(arrastreId: number, event: ChangeEvent<HTMLInputElement>) {
    try {
      const fotos = await readFilesAsDataUrls(event.target.files);
      const current = incidentDrafts[arrastreId] || emptyIncidentDraft;
      setIncidentDraft(arrastreId, { ...current, fotos });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudieron leer las fotos" });
    } finally {
      event.target.value = "";
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
            feedback={feedback}
            stats={stats}
            nextVagones={nextVagones}
            loading={loading}
            refreshing={refreshing}
            onMovimientos={() => router.push("/cliente/torreon/movimientos")}
            onIncidentes={() => router.push("/cliente/torreon/incidentes")}
            onCrear={() => router.push("/cliente/torreon/crear")}
            onRefresh={() => load(true)}
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
            incidentDrafts={incidentDrafts}
            onAmbito={setAmbito}
            onSearch={setSearch}
            onDateFilter={setDateFilter}
            onRefresh={() => load(true)}
            onNuevo={() => router.push("/cliente/torreon/crear")}
            onDraftChange={setIncidentDraft}
            onFiles={handleIncidentFiles}
            onAction={runAction}
            onEditVagon={openEditVagon}
            onCancel={cancelArrastre}
          />
        )}

        {view === "incidentes" && (
          <IncidentesView
            feedback={feedback}
            rows={incidentRows}
            loading={loading}
            refreshing={refreshing}
            search={search}
            dateFilter={dateFilter}
            onSearch={setSearch}
            onDateFilter={setDateFilter}
            onRefresh={() => load(true)}
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
            onRefresh={() => load(true)}
            onGoMovimientos={() => router.push("/cliente/torreon/movimientos")}
            onInstruccionesChange={setInstrucciones}
            onUpdateVagon={updateDraftVagon}
            onRemoveVagon={removeDraftVagon}
            onAddVagon={addDraftVagon}
            onSubmit={submitArrastre}
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
      </div>
    </section>
  );
}
