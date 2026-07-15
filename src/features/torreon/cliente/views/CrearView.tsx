import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Boxes,
  Check,
  ClipboardCheck,
  FileText,
  Flag,
  Loader2,
  MapPin,
  Plus,
  TrainFront,
  Trash2,
} from "lucide-react";
import { ARRASTRE_MAX_CAPACITY, ARRASTRE_MIN_VAGONES } from "@/features/torreon/arrastres";
import { Header } from "../components";
import { fieldClass } from "../utils";
import type { CargaVagon, OperationalVia, VagonDraft } from "../types";

type Props = {
  feedback: ReactNode;
  refreshing: boolean;
  instrucciones: string;
  draftVagones: VagonDraft[];
  draftCapacity: number;
  busyAction: string | null;
  vias: OperationalVia[];
  catalogLoading: boolean;
  catalogError: string | null;
  onRefresh: () => void;
  onGoMovimientos: () => void;
  onInstruccionesChange: (value: string) => void;
  onUpdateVagon: (tempId: number, patch: Partial<VagonDraft>) => void;
  onRemoveVagon: (tempId: number) => void;
  onMoveVagon: (tempId: number, direction: "up" | "down") => void;
  onUsePreviousRoute: (tempId: number) => void;
  onCopyRouteToAll: (tempId: number) => void;
  onAddVagon: () => void;
  onSubmit: () => void;
};

const STEPS = [
  { id: 1, label: "Solicitud", hint: "Qué necesitas mover", icon: FileText },
  { id: 2, label: "Vagones y ruta", hint: "Origen y destino", icon: Boxes },
  { id: 3, label: "Revisar", hint: "Confirma antes de enviar", icon: ClipboardCheck },
] as const;

function routePointLabel(viaId: string, sectionId: string, vias: OperationalVia[]) {
  const via = vias.find((item) => item.id === Number(viaId));
  const section = via?.secciones.find((item) => item.id === Number(sectionId));
  return `${via?.nombre || "Vía pendiente"} · ${section?.nombre || "Sección pendiente"}`;
}

function normalizedWagonNumber(value: string) {
  return value.trim().toLocaleUpperCase("es-MX");
}

export function CrearView({
  feedback,
  instrucciones,
  draftVagones,
  draftCapacity,
  busyAction,
  vias,
  catalogLoading,
  catalogError,
  onGoMovimientos,
  onInstruccionesChange,
  onUpdateVagon,
  onRemoveVagon,
  onMoveVagon,
  onUsePreviousRoute,
  onCopyRouteToAll,
  onAddVagon,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const instructionsReady = instrucciones.trim().length >= 3;
  const repeatedWagonNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    draftVagones.forEach((vagon) => {
      const number = normalizedWagonNumber(vagon.numeroVagon);
      if (number) counts.set(number, (counts.get(number) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([number]) => number));
  }, [draftVagones]);
  const draftIssues = useMemo(() => draftVagones.flatMap((vagon, index) => {
    const label = `Vagón ${index + 1}`;
    const number = normalizedWagonNumber(vagon.numeroVagon);
    const issues: string[] = [];
    if (!number) issues.push(`${label}: captura el número`);
    else if (repeatedWagonNumbers.has(number)) issues.push(`${label}: el número está repetido`);
    if (!vagon.viaOrigenId.trim()) issues.push(`${label}: selecciona la vía de origen`);
    if (vagon.viaOrigenId.trim() && !vagon.seccionOrigenId.trim()) issues.push(`${label}: selecciona la sección de origen`);
    if (!vagon.viaId.trim()) issues.push(`${label}: selecciona la vía de destino`);
    if (vagon.viaId.trim() && !vagon.seccionId.trim()) issues.push(`${label}: selecciona la sección de destino`);
    return issues;
  }), [draftVagones, repeatedWagonNumbers]);
  const capacityReady = draftCapacity <= ARRASTRE_MAX_CAPACITY;
  const wagonsReady = draftVagones.length >= ARRASTRE_MIN_VAGONES && draftIssues.length === 0 && capacityReady;
  const canAddVagon = draftVagones.length < ARRASTRE_MAX_CAPACITY && draftCapacity < ARRASTRE_MAX_CAPACITY;

  const next = () => {
    if (step === 1 && instructionsReady) setStep(2);
    if (step === 2 && wagonsReady) setStep(3);
  };

  return (
    <section className="space-y-5">
      <Header
        title="Solicitar un arrastre"
        subtitle="Torreón · Flujo guiado"
        action={(
          <button type="button" onClick={onGoMovimientos} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <TrainFront className="h-4 w-4" aria-hidden />
            Ver seguimiento
          </button>
        )}
      />

      <ol className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3" aria-label="Pasos para solicitar un arrastre">
        {STEPS.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          const complete = step > item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (item.id < step || (item.id === 2 && instructionsReady) || (item.id === 3 && instructionsReady && wagonsReady)) {
                    setStep(item.id);
                  }
                }}
                aria-current={active ? "step" : undefined}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition ${active ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-800" : "text-slate-500 dark:text-slate-400"}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${complete ? "bg-emerald-600 text-white" : active ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-slate-900"}`}>
                  {complete ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                </span>
                <span>
                  <span className="block text-sm font-black">{item.id}. {item.label}</span>
                  <span className="block text-xs opacity-70">{item.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {feedback}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        {step === 1 ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Paso 1 de 3</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Describe la maniobra</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Escribe una instrucción corta que el coordinador pueda entender sin llamarte.</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">¿Qué necesitas mover?</span>
              <textarea
                autoFocus
                value={instrucciones}
                onChange={(event) => onInstruccionesChange(event.target.value)}
                className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="Ej. Mover los vagones del área de recepción a la vía de armado."
              />
            </label>
            {!instructionsReady && instrucciones.length > 0 ? <p className="text-sm font-bold text-amber-700">Agrega un poco más de detalle para continuar.</p> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Paso 2 de 3</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Agrega vagones y selecciona su ruta</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Elige origen y destino del catálogo exclusivo del patio de Arrastre; las vías naturales no aparecen aquí.</p>
              </div>
              <div className={`rounded-xl border px-4 py-2 text-sm font-black ${draftCapacity < ARRASTRE_MAX_CAPACITY ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>
                {draftCapacity}/{ARRASTRE_MAX_CAPACITY} puntos usados
                <span className="mt-0.5 block text-[11px] font-semibold opacity-75">Vacío usa 1 · Lleno usa 2</span>
              </div>
            </div>

            {catalogLoading ? <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" /> : null}
            {catalogError ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{catalogError}</p> : null}

            <div className="grid gap-4">
              {draftVagones.map((vagon, index) => (
                <VagonDraftCard
                  key={vagon.tempId}
                  vagon={vagon}
                  index={index}
                  vias={vias}
                  disableRemove={draftVagones.length === 1}
                  canMoveUp={index > 0}
                  canMoveDown={index < draftVagones.length - 1}
                  canSetFull={vagon.carga === "LLENO" || draftCapacity < ARRASTRE_MAX_CAPACITY}
                  onUpdate={onUpdateVagon}
                  onRemove={onRemoveVagon}
                  onMove={onMoveVagon}
                  onUsePreviousRoute={onUsePreviousRoute}
                  onCopyRouteToAll={onCopyRouteToAll}
                />
              ))}
            </div>

            <button type="button" onClick={onAddVagon} disabled={!canAddVagon} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-400">
              <Plus className="h-4 w-4" aria-hidden />
              {canAddVagon ? "Agregar otro vagón" : "Capacidad máxima alcanzada"}
            </button>

            {!wagonsReady ? (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                <p className="text-sm font-black">Completa lo siguiente para continuar:</p>
                <ul className="mt-2 grid gap-1 text-sm font-semibold sm:grid-cols-2">
                  {draftIssues.slice(0, 6).map((issue) => <li key={issue}>• {issue}</li>)}
                </ul>
                {draftIssues.length > 6 ? <p className="mt-2 text-xs font-bold">Y {draftIssues.length - 6} dato(s) más.</p> : null}
              </div>
            ) : (
              <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200">
                <Check className="h-4 w-4" aria-hidden /> Vagones y rutas completos. Ya puedes continuar.
              </p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mx-auto max-w-4xl space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Paso 3 de 3</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Revisa antes de enviar</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">El coordinador recibirá exactamente esta información.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Maniobra</p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">{instrucciones.trim()}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {draftVagones.map((vagon, index) => (
                <article key={vagon.tempId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-black text-slate-950 dark:text-white">Vagón {index + 1} · {vagon.numeroVagon}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">{vagon.carga === "LLENO" ? "Lleno" : "Vacío"}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {routePointLabel(vagon.viaOrigenId, vagon.seccionOrigenId, vias)}
                    <ArrowRight className="mx-2 inline h-4 w-4 text-emerald-600" aria-hidden />
                    {routePointLabel(vagon.viaId, vagon.seccionId, vias)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => step === 1 ? onGoMovimientos() : setStep((step - 1) as 1 | 2)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {step === 1 ? "Cancelar" : "Anterior"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              disabled={(step === 1 && !instructionsReady) || (step === 2 && !wagonsReady)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950"
            >
              Continuar
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={busyAction === "crear"} className="inline-flex min-h-11 min-w-[190px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {busyAction === "crear" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {busyAction === "crear" ? "Enviando…" : "Enviar solicitud"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function VagonDraftCard({
  vagon,
  index,
  vias,
  disableRemove,
  canMoveUp,
  canMoveDown,
  canSetFull,
  onUpdate,
  onRemove,
  onMove,
  onUsePreviousRoute,
  onCopyRouteToAll,
}: {
  vagon: VagonDraft;
  index: number;
  vias: OperationalVia[];
  disableRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canSetFull: boolean;
  onUpdate: (tempId: number, patch: Partial<VagonDraft>) => void;
  onRemove: (tempId: number) => void;
  onMove: (tempId: number, direction: "up" | "down") => void;
  onUsePreviousRoute: (tempId: number) => void;
  onCopyRouteToAll: (tempId: number) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 font-black text-white dark:bg-white dark:text-slate-950">{index + 1}</span>
          <div>
            <h3 className="font-black text-slate-950 dark:text-white">Vagón {index + 1}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Define su carga, origen y destino.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <SmallIconButton label="Subir vagón" disabled={!canMoveUp} onClick={() => onMove(vagon.tempId, "up")}><ArrowUp className="h-4 w-4" /></SmallIconButton>
          <SmallIconButton label="Bajar vagón" disabled={!canMoveDown} onClick={() => onMove(vagon.tempId, "down")}><ArrowDown className="h-4 w-4" /></SmallIconButton>
          <SmallIconButton label="Quitar vagón" disabled={disableRemove} danger onClick={() => onRemove(vagon.tempId)}><Trash2 className="h-4 w-4" /></SmallIconButton>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px]">
        <label>
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Número de vagón <span className="text-rose-600">*</span></span>
          <input
            value={vagon.numeroVagon}
            onChange={(event) => onUpdate(vagon.tempId, { numeroVagon: event.target.value })}
            className={`${fieldClass()} ${vagon.numeroVagon.trim() ? "" : "border-amber-300 bg-amber-50/40"}`}
            placeholder="Ej. FRT-204"
            maxLength={40}
            required
            aria-invalid={!vagon.numeroVagon.trim()}
          />
          <span className="mt-1 block text-xs font-semibold text-slate-500">Obligatorio para identificarlo durante toda la maniobra.</span>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Carga</span>
          <select value={vagon.carga} onChange={(event) => onUpdate(vagon.tempId, { carga: event.target.value as CargaVagon })} className={fieldClass()}>
            <option value="VACIO">Vacío · capacidad 1</option>
            <option value="LLENO" disabled={!canSetFull}>Lleno · capacidad 2{!canSetFull ? " · sin espacio" : ""}</option>
          </select>
          <span className="mt-1 block text-xs font-semibold text-slate-500">La solicitud acepta hasta 8 puntos de capacidad.</span>
        </label>
      </div>

      <div className="mt-5 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
        <RouteSelector
          title="Origen"
          vias={vias}
          viaValue={vagon.viaOrigenId}
          sectionValue={vagon.seccionOrigenId}
          onVia={(value) => {
            const via = vias.find((item) => item.id === Number(value));
            onUpdate(vagon.tempId, {
              viaOrigenId: value,
              seccionOrigenId: via?.secciones.length === 1 ? String(via.secciones[0].id) : "",
            });
          }}
          onSection={(value) => onUpdate(vagon.tempId, { seccionOrigenId: value })}
        />
        <div className="hidden items-center justify-center lg:flex" aria-hidden>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"><ArrowRight className="h-4 w-4" /></span>
        </div>
        <RouteSelector
          title="Destino"
          vias={vias}
          viaValue={vagon.viaId}
          sectionValue={vagon.seccionId}
          onVia={(value) => {
            const via = vias.find((item) => item.id === Number(value));
            onUpdate(vagon.tempId, {
              viaId: value,
              seccionId: via?.secciones.length === 1 ? String(via.secciones[0].id) : "",
            });
          }}
          onSection={(value) => onUpdate(vagon.tempId, { seccionId: value })}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!canMoveUp} onClick={() => onUsePreviousRoute(vagon.tempId)} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">Usar ruta anterior</button>
        <button type="button" onClick={() => onCopyRouteToAll(vagon.tempId)} className="min-h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">Copiar esta ruta a todos</button>
      </div>
    </article>
  );
}

function RouteSelector({
  title,
  vias,
  viaValue,
  sectionValue,
  onVia,
  onSection,
}: {
  title: "Origen" | "Destino";
  vias: OperationalVia[];
  viaValue: string;
  sectionValue: string;
  onVia: (value: string) => void;
  onSection: (value: string) => void;
}) {
  const selectedVia = useMemo(() => vias.find((via) => via.id === Number(viaValue)), [viaValue, vias]);
  const sectionOptions = selectedVia?.secciones || [];
  const selectedSection = sectionOptions.find((section) => section.id === Number(sectionValue));
  const complete = Boolean(selectedVia && selectedSection);
  const isOrigin = title === "Origen";
  const Icon = isOrigin ? MapPin : Flag;
  const cardClasses = isOrigin
    ? "border-emerald-200 bg-emerald-50/45 dark:border-emerald-900 dark:bg-emerald-950/15"
    : "border-blue-200 bg-blue-50/45 dark:border-blue-900 dark:bg-blue-950/15";
  const accentClasses = isOrigin
    ? "bg-emerald-600 text-white"
    : "bg-blue-600 text-white";
  const textClasses = isOrigin
    ? "text-emerald-800 dark:text-emerald-200"
    : "text-blue-800 dark:text-blue-200";

  return (
    <fieldset className={`rounded-2xl border p-4 ${cardClasses}`}>
      <legend className="sr-only">Punto de {title.toLocaleLowerCase("es-MX")}</legend>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accentClasses}`}><Icon className="h-5 w-5" aria-hidden /></span>
          <div>
            <p className={`text-[11px] font-black uppercase tracking-[0.16em] ${textClasses}`}>{isOrigin ? "1 · Punto de salida" : "2 · Punto de llegada"}</p>
            <h4 className="text-base font-black text-slate-950 dark:text-white">{title}</h4>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${complete ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-700"}`}>
          {complete ? "Completo" : "Pendiente"}
        </span>
      </div>

      <div className="grid gap-3">
        <label>
          <span className="mb-1.5 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] text-white dark:bg-white dark:text-slate-900">1</span> Selecciona la vía</span>
          <select value={viaValue} onChange={(event) => onVia(event.target.value)} disabled={!vias.length} className={`${fieldClass()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}>
            <option value="">{vias.length ? `Elige vía de ${title.toLocaleLowerCase("es-MX")}` : "Patio de Arrastre sin configurar"}</option>
            {vias.map((via) => <option key={via.id} value={String(via.id)}>{via.nombre}{via.ocupada ? " · ocupada" : ""}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1.5 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] text-white dark:bg-white dark:text-slate-900">2</span> Selecciona la sección</span>
          <select value={sectionValue} onChange={(event) => onSection(event.target.value)} disabled={!selectedVia} className={`${fieldClass()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}>
            <option value="">{selectedVia ? "Elige una sección" : "Primero selecciona la vía"}</option>
            {sectionOptions.map((section) => <option key={section.id} value={String(section.id)}>{section.nombre}{section.ocupada ? " · ocupada" : ""}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
        {selectedVia && selectedSection ? `${selectedVia.nombre} · ${selectedSection.nombre}` : `Falta completar el ${title.toLocaleLowerCase("es-MX")}.`}
      </div>
    </fieldset>
  );
}

function SmallIconButton({ children, label, disabled, danger = false, onClick }: { children: ReactNode; label: string; disabled: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`grid h-10 w-10 place-items-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-35 dark:bg-slate-950 ${danger ? "border-rose-200 text-rose-600 dark:border-rose-900" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
      {children}
    </button>
  );
}
