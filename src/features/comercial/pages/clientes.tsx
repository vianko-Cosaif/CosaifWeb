"use client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { useState } from "react";
import dynamic from "next/dynamic";
import responsive from "../components/CommercialRecords.module.css";
import { Mail, Phone, Plus, Search, UsersRound } from "lucide-react";
import type { CrmClient } from "../types";
import { buildQuery } from "../lib/api";
import { useCrmList } from "../lib/useCrmList";
import { useCommercialData } from "../components/CommercialDataProvider";
import { EmptyPanel, LoadingPanel, ModuleHeader, Notice, Pagination } from "../components/CommercialUi";

const CreateClientModal = dynamic(() => import("../components/clients/CreateClientModal"), {
  loading: () => <p role="status" className="commercial-card p-4 text-sm text-[var(--app-text-muted)]">Preparando expediente…</p>,
});

export default function CommercialClientsPage() {
  const { catalogs } = useCommercialData();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim().slice(0, 100));
  const { items: clients, loading, error, reload, meta, page, setPage } = useCrmList<CrmClient>(`/bff/comercial/clientes?${buildQuery({ q: search })}`);
  const [selectedId, setSelectedId] = useState<number>();
  const [creating, setCreating] = useState(false);
  const selected = clients.find((item) => item.id === selectedId) ?? clients[0];
  const companies = catalogs?.companies ?? [];

  return <div className={`${responsive.container} space-y-5`}>
    <ModuleHeader eyebrow="Administración de cartera" title="Clientes y contactos" description="Cada cliente tiene su expediente comercial separado de la operación: razón social, condiciones, facturación, cobranza y contactos responsables." icon={UsersRound} actions={<button type="button" onClick={() => setCreating(true)} className="commercial-primary"><Plus className="h-4 w-4"/>Activar cliente</button>}/>
    <section className="commercial-card p-4"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="commercial-input pl-10" aria-label="Buscar cliente o RFC" placeholder="Buscar cliente, RFC…" maxLength={100}/></label></section>
    {error ? <Notice title="No se pudieron cargar los clientes" text={error}/> : null}
    {loading ? <LoadingPanel text="Cargando expedientes comerciales…"/> : <section className={responsive.clientLayout}>
      <aside className="commercial-card h-fit p-4"><div className={`${responsive.clientList} space-y-2`}>{clients.map((client) => <button key={client.id} type="button" aria-pressed={selected?.id === client.id} onClick={() => setSelectedId(client.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === client.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-[var(--app-border)] hover:bg-[var(--app-surface-muted)]"}`}><p className="font-black text-[var(--app-text)]">{client.empresaNombre}</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">{client.razonSocial || "Razón social pendiente"}</p></button>)}</div><Pagination page={page} pages={meta?.totalPages ?? 1} total={meta?.total ?? 0} onChange={setPage}/></aside>
      {selected ? <article className="commercial-card overflow-hidden"><header className="bg-gradient-to-r from-slate-950 to-emerald-950 p-4 text-white sm:p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-300">Expediente comercial</p><h2 className="mt-1 break-words text-xl font-semibold sm:text-2xl">{selected.empresaNombre}</h2><p className="mt-2 text-sm text-slate-300">{selected.razonSocial || "Razón social pendiente"}{selected.rfc ? ` · ${selected.rfc}` : ""}</p></header><div className="grid gap-4 p-5 lg:grid-cols-2"><Info title="Condiciones"><Row label="Moneda" value={selected.moneda}/><Row label="Días de crédito" value={`${selected.diasCredito} días`}/><Row label="Orden de compra" value={selected.requiereOrdenCompra ? "Obligatoria" : "No obligatoria"}/><Row label="Estado" value={selected.activo ? "Activo" : "Inactivo"}/></Info><Info title="Facturación y cobranza"><Row label="Facturación" value={selected.correoFacturacion || "Pendiente"}/><Row label="Cobranza" value={selected.correoCobranza || "Pendiente"}/></Info><section className="rounded-2xl border border-[var(--app-border)] p-4 lg:col-span-2"><div className="flex items-center justify-between"><h3 className="font-black text-[var(--app-text)]">Contactos responsables</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{selected.contactos.length}</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{selected.contactos.map((contact) => <div key={contact.id} className="rounded-xl bg-[var(--app-surface-muted)] p-4"><p className="font-black text-[var(--app-text)]">{contact.nombre}</p><p className="text-xs text-[var(--app-text-muted)]">{contact.puesto || contact.tipo}</p><div className="mt-2 space-y-1 text-xs font-bold text-[var(--app-text-muted)]">{contact.email ? <p className="flex min-w-0 items-start gap-2 break-all"><Mail className="h-3.5 w-3.5"/>{contact.email}</p> : null}{contact.telefono ? <p className="flex gap-2"><Phone className="h-3.5 w-3.5"/>{contact.telefono}</p> : null}</div></div>)}{!selected.contactos.length ? <p className="text-sm text-[var(--app-text-muted)]">Todavía no hay contactos registrados.</p> : null}</div></section></div></article> : <EmptyPanel title="Seleccione un cliente" text="Abra un expediente para revisar sus datos comerciales y contactos."/>}
    </section>}
    {creating ? <CreateClientModal companies={companies} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }}/> : null}
  </div>;
}

function Info({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[var(--app-border)] p-4"><h3 className="font-black text-[var(--app-text)]">{title}</h3><div className="mt-3">{children}</div></section>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-[var(--app-border)] py-2 text-sm"><span className="shrink-0 text-[var(--app-text-muted)]">{label}</span><span className="min-w-0 break-all text-right font-semibold text-[var(--app-text)]">{value}</span></div>; }
