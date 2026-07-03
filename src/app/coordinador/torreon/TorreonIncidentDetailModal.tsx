"use client";

import { AlertTriangle, CalendarClock, Camera, CheckCircle2, Hash, MapPin, X, type LucideIcon } from "lucide-react";

export type TorreonIncidentImage = {
  id?: number | string | null;
  orden?: number | null;
  url?: string | null;
  comentario?: string | null;
  tomadaAt?: string | null;
};

export type TorreonIncidentDetail = {
  id?: number | string | null;
  estado?: string | null;
  motivo?: string | null;
  descripcion?: string | null;
  solucion?: string | null;
  fechaInicio?: string | null;
  fechaResolucion?: string | null;
  viaBloqueadaId?: number | null;
  seccionBloqueadaId?: number | null;
  vagonId?: number | null;
  fotos?: TorreonIncidentImage[] | null;
  imagenes?: string[] | null;
};

type Props = {
  incident: TorreonIncidentDetail;
  title: string;
  subtitle?: string;
  onClose: () => void;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase() || "SIN ESTADO";
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: string) {
  if (status === "ABIERTO") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "RESUELTO" || status === "CERRADO") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "CANCELADO") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function incidentImages(incident: TorreonIncidentDetail) {
  const fotos = Array.isArray(incident.fotos) ? incident.fotos : [];
  if (fotos.length) return fotos.filter((foto) => Boolean(foto.url));
  return (incident.imagenes || [])
    .filter(Boolean)
    .map<TorreonIncidentImage>((url, index) => ({ url, orden: index + 1 }));
}

export default function TorreonIncidentDetailModal({ incident, title, subtitle, onClose }: Props) {
  const status = normalizeStatus(incident.estado);
  const fotos = incidentImages(incident);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 dark:bg-black/75">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">Incidente Torreon</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Cerrar incidente"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <InfoTile icon={Hash} label="Incidente" value={incident.id ? `#${incident.id}` : "--"} />
            <InfoTile icon={CalendarClock} label="Inicio" value={formatDate(incident.fechaInicio)} />
            <InfoTile icon={CheckCircle2} label="Resolucion" value={formatDate(incident.fechaResolucion)} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Estado</p>
              <span className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>
                {status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Motivo
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                {incident.motivo || incident.descripcion || "Sin motivo capturado."}
              </p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Solucion
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
                {incident.solucion || "Pendiente de resolucion."}
              </p>
            </section>
          </div>

          {(incident.viaBloqueadaId || incident.seccionBloqueadaId || incident.vagonId) && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                <MapPin className="h-4 w-4 text-slate-500" />
                Bloqueo
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600 dark:text-slate-300">
                {incident.viaBloqueadaId ? <span className="rounded-lg bg-white px-3 py-1.5 dark:bg-slate-900">Via {incident.viaBloqueadaId}</span> : null}
                {incident.seccionBloqueadaId ? <span className="rounded-lg bg-white px-3 py-1.5 dark:bg-slate-900">Seccion {incident.seccionBloqueadaId}</span> : null}
                {incident.vagonId ? <span className="rounded-lg bg-white px-3 py-1.5 dark:bg-slate-900">Vagon #{incident.vagonId}</span> : null}
              </div>
            </div>
          )}

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                <Camera className="h-4 w-4 text-slate-500" />
                Evidencias
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{fotos.length}</span>
            </div>
            {fotos.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {fotos.map((foto, index) => (
                  <figure key={`${foto.id ?? index}-${foto.url}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                    <img src={String(foto.url)} alt={`Incidente ${incident.id ?? ""} foto ${foto.orden ?? index + 1}`} className="h-60 w-full bg-slate-950 object-contain" />
                    <figcaption className="space-y-1 p-3 text-xs text-slate-500 dark:text-slate-400">
                      <p className="font-bold text-slate-700 dark:text-slate-200">Captura {foto.orden ?? index + 1}</p>
                      <p>{formatDate(foto.tomadaAt)}</p>
                      {foto.comentario ? <p>{foto.comentario}</p> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Sin evidencias registradas.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
