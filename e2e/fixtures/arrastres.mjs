// Synthetic data only. Enough rows to detect first-page truncation.
export const arrastres = Array.from({ length: 154 }, (_, index) => {
  const id = index + 1,
    history = id > 150;
  return {
    id,
    folioLabel: `#${id}`,
    empresaId: id % 2 ? 3 : 4,
    localidadId: 2,
    estado: history ? "CONCLUIDO" : "SOLICITADO",
    ordenSolicitud: id,
    fechaSolicitud: "2026-09-17T12:00:00Z",
    fechaInicio: history ? "2026-09-17T13:00:00Z" : null,
    fechaFin: history ? "2026-09-17T14:00:00Z" : null,
    instrucciones: `Solicitud de prueba ${id}`,
    incidentes: [],
    vagones: [
      {
        id,
        orden: 1,
        numeroVagon: `FXE-${id}`,
        estado: history ? "CONCLUIDO" : "PENDIENTE",
        carga: "VACIO",
        viaOrigenId: 1,
        viaId: 2,
        viaOrigenNombre: "Vía de recepción",
        viaDestinoNombre: "Vía de salida",
        seccionOrigenId: 1,
        seccionId: 2,
      },
    ],
  };
});
export function arrastresPage(params) {
  const history = params.get("vista") === "historial";
  const q = (params.get("q") || "").toLowerCase();
  const rows = arrastres.filter(
    (row) =>
      row.localidadId === Number(params.get("localidadId")) &&
      (!params.has("empresaId") || row.empresaId === Number(params.get("empresaId"))) &&
      (row.estado === "CONCLUIDO") === history &&
      (!q || `${row.folioLabel} ${row.vagones[0].numeroVagon}`.toLowerCase().includes(q)),
  );
  const page = Number(params.get("page") || 1),
    pageSize = Number(params.get("pageSize") || 8);
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      page,
      pageSize,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      statusCounts: { [history ? "CONCLUIDO" : "SOLICITADO"]: rows.length },
      pendingWagons: history ? 0 : rows.length,
      openIncidents: 0,
      canPrioritize: false,
    },
  };
}
