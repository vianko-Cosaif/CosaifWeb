"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import type { AppRole } from "@/lib/accessControl";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";

type HelpGuideAction = "general-help" | "full-role-training";

export type HelpSuggestion = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  roles?: AppRole[];
  action: HelpGuideAction;
  guideId?: string;
};

const HELP_GUIDE_CATALOG: HelpSuggestion[] = [
  {
    id: "dashboard-training",
    label: "Empieza aquí: menú y Operación",
    description: "Práctica corta para aprender dónde estás, qué botón pulsar y cómo leer la primera ronda.",
    keywords: ["dashboard", "inicio", "operacion", "rondas", "tarjetas", "orden", "localidad"],
    roles: ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "ARRASTRE_TORREON"],
    action: "general-help",
    guideId: "dashboard-training",
  },
  {
    id: "role-training",
    label: "Paso a paso dentro de Cosaif",
    description: "La guía abre tus pantallas reales, señala un control a la vez y utiliza solamente datos SIM.",
    keywords: ["completo", "paso a paso", "practica", "dashboard", "rol", "capacitacion", "nuevo", "ayuda"],
    action: "full-role-training",
  },
  {
    id: "movements-training",
    label: "Entender movimientos y estados",
    description: "Cómo consultar activos, historial y detalle, y qué revisar antes de crear o cambiar algo.",
    keywords: ["movimientos", "seguimiento", "activos", "historial", "estados", "detalle", "solicitud"],
    roles: ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"],
    action: "general-help",
    guideId: "movements-training",
  },
  {
    id: "rounds-training",
    label: "Rondas: consultar, ordenar y cancelar",
    description: "Aclara quién ve la ronda, cómo reordenarla y por qué cancelar afecta al movimiento completo.",
    keywords: ["rondas", "orden", "flechas", "arrastrar", "editar", "cancelar", "movimiento", "empresa"],
    roles: ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"],
    action: "general-help",
    guideId: "rounds-training",
  },
  {
    id: "create-movement-overview",
    label: "Crear un movimiento sin equivocarse",
    description: "Servicio, locomotora, ruta o mediciones, comentarios, resumen y confirmación.",
    keywords: ["crear", "movimiento", "nuevo", "solicitud", "servicio", "locomotora", "confirmacion"],
    roles: ["ADMINISTRADOR", "COORDINADOR", "CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"],
    action: "general-help",
    guideId: "create-movement-overview",
  },
  {
    id: "torno-training",
    label: "Torno desde cero",
    description: "Movimiento contra Torneado, mediciones de ruedas, agenda, historial y PDF.",
    keywords: ["torno", "torneado", "ruedas", "medidas", "agendado", "recuperacion", "pdf", "navajas"],
    roles: ["COORDINADOR", "SUPERVISOR", "CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"],
    action: "general-help",
    guideId: "torno-training",
  },
  {
    id: "incidents-training",
    label: "Incidentes: registrar y dar seguimiento",
    description: "Alcance por localidad, actuales y pasados, evidencia, resolución y efectos operativos.",
    keywords: ["incidentes", "localidad", "actuales", "pasados", "cancelacion", "historial", "evidencia", "seguimiento"],
    roles: ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "ARRASTRE_TORREON"],
    action: "general-help",
    guideId: "incidents-training",
  },
  {
    id: "admin-users-overview",
    label: "Usuarios, roles y permisos",
    description: "Altas, asignación correcta de empresa/localidad, contraseñas y desactivación segura.",
    keywords: ["administrador", "coordinador", "usuarios", "permisos", "roles", "contrasena", "seguridad", "localidad"],
    roles: ["ADMINISTRADOR", "COORDINADOR"],
    action: "general-help",
    guideId: "admin-users-overview",
  },
  {
    id: "admin-config-overview",
    label: "Configuración: empresas, patios y catálogos",
    description: "Qué revisar antes de editar o desactivar datos que utiliza toda la operación.",
    keywords: ["administrador", "configuracion", "empresas", "patios", "catalogos", "desactivar"],
    roles: ["ADMINISTRADOR"],
    action: "general-help",
    guideId: "admin-config-overview",
  },
  {
    id: "reports-overview",
    label: "Reportería: filtros y exportación",
    description: "Cómo validar periodo, localidad, empresa, totales y archivo antes de compartir.",
    keywords: ["reporteria", "reportes", "excel", "pdf", "exportar", "filtros", "historico"],
    roles: ["ADMINISTRADOR", "COORDINADOR", "COMERCIAL"],
    action: "general-help",
    guideId: "reports-overview",
  },
  {
    id: "arrastre-overview",
    label: "Arrastres de Torreón desde cero",
    description: "Solicitudes de vagones, composición, seguimiento e incidentes sin mezclar otros servicios.",
    keywords: ["torreon", "arrastre", "vagones", "composicion", "solicitud", "seguimiento"],
    roles: ["ARRASTRE_TORREON", "CLIENTE_ADMIN", "CLIENTE_COOR"],
    action: "general-help",
    guideId: "arrastre-overview",
  },
  {
    id: "commercial-overview",
    label: "Capacitación completa del área comercial",
    description: "Clientes, contratos, movimientos contratados, cortes, saldos y reportes en el orden correcto.",
    keywords: ["comercial", "clientes", "contratos", "consumo", "cortes", "saldos", "reportes"],
    roles: ["COMERCIAL"],
    action: "general-help",
    guideId: "commercial-overview",
  },
  {
    id: "commercial-clients-overview",
    label: "Comercial: clientes y contactos",
    description: "Cómo evitar duplicados y mantener expedientes comerciales utilizables.",
    keywords: ["comercial", "clientes", "contactos", "expediente", "duplicados"],
    roles: ["COMERCIAL"],
    action: "general-help",
    guideId: "commercial-clients-overview",
  },
  {
    id: "commercial-contracts-overview",
    label: "Comercial: contratos y vigencias",
    description: "Cliente, localidad, periodo y efectos de modificar un contrato con consumo.",
    keywords: ["comercial", "contratos", "vigencia", "reglas", "cliente", "consumo"],
    roles: ["COMERCIAL"],
    action: "general-help",
    guideId: "commercial-contracts-overview",
  },
  {
    id: "commercial-packages-overview",
    label: "Comercial: movimientos contratados",
    description: "Cantidades incluidas, consumo por periodo y diferencias con una solicitud operativa.",
    keywords: ["comercial", "movimientos", "contratados", "paquetes", "cantidades", "consumo"],
    roles: ["COMERCIAL"],
    action: "general-help",
    guideId: "commercial-packages-overview",
  },
  {
    id: "commercial-collections-overview",
    label: "Comercial: cortes y saldos",
    description: "Qué validar antes de cerrar un periodo o registrar un saldo manual.",
    keywords: ["comercial", "cortes", "saldos", "cobranza", "periodo", "cierre"],
    roles: ["COMERCIAL"],
    action: "general-help",
    guideId: "commercial-collections-overview",
  },
];

export default function SidebarHelpDialog({ role, onClose, onSelect }: {
  role: AppRole;
  onClose: () => void;
  onSelect: (suggestion: HelpSuggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const suggestions = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return HELP_GUIDE_CATALOG.filter(item => (!item.roles || item.roles.includes(role)) &&
      terms.every(term => normalize([item.label, item.description, ...item.keywords].join(" ")).includes(term)));
  }, [query, role]);

  return <Modal title="Centro de capacitación" onClose={onClose} maxWidth="max-w-2xl" closeLabel="Cerrar ayuda">
    <div id="sidebar-help-panel" className="space-y-4">
      <p className="text-sm leading-6 text-[var(--app-text-muted)]">
        Encuentra una guía para tu operación. Los recorridos usan datos de ejemplo y no guardan cambios.
      </p>
      <SearchInput value={query} onChange={setQuery} onClear={() => setQuery("")} label="Buscar ayuda" placeholder="Busca rondas, movimientos o incidentes" />
      <p role="status" className="text-xs text-[var(--app-text-muted)]">{suggestions.length} guías disponibles</p>
      <div className="grid gap-2">
        {suggestions.map(suggestion => <button key={suggestion.id} type="button" onClick={() => onSelect(suggestion)}
          className="group flex min-w-0 items-start gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-left transition-colors hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[var(--app-accent)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--app-text)]">{suggestion.label}</span>
            <span className="mt-1 block text-sm leading-5 text-[var(--app-text-muted)]">{suggestion.description}</span>
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--app-text-soft)]" aria-hidden />
        </button>)}
        {!suggestions.length ? <p className="rounded-xl border border-dashed border-[var(--app-border)] p-5 text-sm leading-6 text-[var(--app-text-muted)]">
          No hay guías con esa búsqueda. Prueba con rondas, movimiento, incidentes o contratos.
        </p> : null}
      </div>
    </div>
  </Modal>;
}
