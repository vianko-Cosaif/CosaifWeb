export type CrmTab = "inicio" | "clientes" | "contratos" | "cobranza" | "analisis" | "excel";
export type CommercialPeriod = "WEEK" | "MONTH" | "BIMONTH" | "SEMESTER" | "YEAR";
export type CommercialOrigin = "NATURAL" | "ARRASTRE";

export type CommercialOperation = {
  key: string;
  sourceSystem: "COSAIF" | "TORREON";
  origin: "NATURAL" | "ARRASTRE";
  sourceId: string;
  empresaId: number;
  empresa: string;
  localidadId: number;
  localidad: string;
  locomotiveNumber: number | null;
  wagons: number;
  status: string;
  completed: boolean;
  cancelled: boolean;
  stopped: boolean;
  services: Array<"MOVIMIENTO" | "LAVADO" | "TORNEADO">;
  requestedAt: string;
  completedAt: string | null;
  operationAt: string;
  incidents: number;
  reference: string;
};

export type AnalyticsSummary = {
  meta: {
    tz: string;
    months: number;
    range: { from: string; toExclusive: string };
    previousRange: { from: string; toExclusive: string };
    reference: string;
    referenceDate: string;
    period: CommercialPeriod;
    periodLabel: string;
    torreonAvailable: boolean;
    readOnly: boolean;
  };
  catalogs: {
    companies: Array<{ id: number; nombre: string }>;
    localities: Array<{ id: number; nombre: string; estado: string }>;
  };
  kpis: {
    operations: number;
    completed: number;
    cancelled: number;
    stopped: number;
    incidents: number;
    natural: number;
    arrastre: number;
    wagons: number;
    wash: number;
    turning: number;
    currentMonth: number;
    previousMonth: number;
    monthlyGrowthPct: number;
    selectedPeriod: number;
    previousPeriod: number;
    periodGrowthPct: number;
    completedGrowthPct: number;
  };
  trend: Array<{
    key: string;
    label: string;
    natural: number;
    arrastre: number;
    wagons: number;
    wash: number;
    turning: number;
    total: number;
    completed: number;
    cancelled: number;
  }>;
  currentBreakdown: Array<{
    empresaId: number;
    localidadId: number;
    empresa: string;
    localidad: string;
    natural: number;
    arrastre: number;
    wagons: number;
    wash: number;
    turning: number;
    completed: number;
  }>;
  contractBreakdown: Array<{
    empresaId: number;
    localidadId: number;
    empresa: string;
    localidad: string;
    origin: "NATURAL" | "ARRASTRE";
    service: "MOVIMIENTO" | "LAVADO" | "TORNEADO";
    status: string;
    count: number;
    wagons: number;
    incidents: number;
  }>;
  clients: AnalyticsBreakdown[];
  yards: AnalyticsBreakdown[];
  operations: { data: CommercialOperation[]; meta: PageMeta };
};

export type AnalyticsBreakdown = {
  id: number;
  name: string;
  total: number;
  completed: number;
  natural: number;
  arrastre: number;
  wagons: number;
  wash: number;
  turning: number;
};

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type PageResponse<T> = { data: T[]; meta: PageMeta };

export type CrmClient = {
  id: number;
  empresaId: number;
  empresaNombre: string;
  razonSocial: string | null;
  rfc: string | null;
  moneda: string;
  diasCredito: number;
  correoFacturacion: string | null;
  correoCobranza: string | null;
  requiereOrdenCompra: boolean;
  notas: string | null;
  activo: boolean;
  contactos: Array<{
    id: number;
    nombre: string;
    puesto: string | null;
    tipo: string;
    email: string | null;
    telefono: string | null;
    principal: boolean;
    activo: boolean;
  }>;
  _count?: { contratos: number; tarifas: number; planes: number };
};

export type Contract = {
  id: number;
  clienteComercialId: number;
  folio: string;
  nombre: string;
  ordenCompra: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  estado: "BORRADOR" | "VIGENTE" | "VENCIDO" | "CANCELADO";
  moneda: string;
  montoMaximo: string | null;
  diaCorte: number | null;
  documentoUrl: string | null;
  notas: string | null;
  cliente?: Pick<CrmClient, "id" | "empresaId" | "empresaNombre">;
  paquetes?: Array<{
    id: number;
    nombre: string;
    unidad: "EVENTO" | "MOVIMIENTO" | "VAGON" | "SERVICIO" | "HORA" | "DIA" | "LOCOMOTORA" | "TARIFA_FIJA";
    periodicidad: "UNICO" | "SEMANAL" | "MENSUAL" | "BIMESTRAL" | "SEMESTRAL" | "ANUAL" | "VIGENCIA_COMPLETA";
    cantidadIncluida: string | null;
  }>;
  _count?: { tarifas: number; planes: number; paquetes: number };
};

export type Package = {
  id: number;
  clienteComercialId: number;
  contratoId: number | null;
  tarifaExcedenteId: number | null;
  nombre: string;
  servicio: "MOVIMIENTO" | "LAVADO" | "TORNEADO" | "DETENCION" | "CANCELACION" | "OTRO";
  origenOperacion: "NATURAL" | "ARRASTRE" | null;
  unidad: "EVENTO" | "MOVIMIENTO" | "VAGON" | "SERVICIO" | "HORA" | "DIA" | "LOCOMOTORA" | "TARIFA_FIJA";
  periodicidad: "UNICO" | "SEMANAL" | "MENSUAL" | "BIMESTRAL" | "SEMESTRAL" | "ANUAL" | "VIGENCIA_COMPLETA";
  localidadId: number | null;
  estadosIncluidos: string[];
  cantidadIncluida: string | null;
  montoPaquete: string | null;
  importeExcedente: string | null;
  moneda: string;
  vigenciaInicio: string;
  vigenciaFin: string | null;
  activo: boolean;
  notas: string | null;
  cliente?: Pick<CrmClient, "id" | "empresaId" | "empresaNombre">;
  contrato?: Pick<Contract, "id" | "folio" | "nombre" | "estado"> | null;
};

export type BillingCut = {
  id: number;
  clienteComercialId: number;
  contratoId: number | null;
  folio: string;
  periodoInicio: string;
  periodoFin: string;
  fechaCorte: string;
  fechaVencimiento: string | null;
  estado: "BORRADOR" | "EN_REVISION" | "APROBADO" | "FACTURADO" | "PARCIAL" | "PAGADO" | "VENCIDO" | "CANCELADO";
  subtotal: string | null;
  iva: string | null;
  total: string | null;
  moneda: string;
  facturaFolio: string | null;
  notas: string | null;
  cliente: Pick<CrmClient, "id" | "empresaId" | "empresaNombre" | "diasCredito">;
  contrato?: Pick<Contract, "id" | "folio" | "nombre" | "diaCorte"> | null;
  pagos: Array<{ id: number; monto: string; fechaPago: string; referencia: string | null; metodo: string | null }>;
  detalles?: Array<{ id: number; localidadId: number | null; servicio: string; fuente: string; cantidad: string; fechaServicio: string }>;
  cobranza: { total: number | null; pagado: number; saldo: number | null; vencido: boolean; montoPendienteCaptura: boolean };
};

export type CollectionSummary = {
  facturado: number;
  cobrado: number;
  porCobrar: number;
  vencido: number;
  cortes: number;
  cortesSinMonto: number;
  promesasPago: number;
  promesas: number;
  gestionesPendientes: number;
};
