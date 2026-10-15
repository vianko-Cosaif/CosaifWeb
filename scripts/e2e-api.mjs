import { createServer } from "node:http";
import { arrastresPage } from "../e2e/fixtures/arrastres.mjs";
import fixtureProfiles from "../e2e/fixtures/authorization.json" with { type: "json" };
import {
  empresas,
  localidades,
  movimientos,
  rondas,
  inRequestedScope,
  commercialAnalytics,
} from "../e2e/fixtures/operations.mjs";

const profiles = {
  ...fixtureProfiles,
  supervisor_torreon: {
    ...fixtureProfiles.supervisor,
    scope: { ...fixtureProfiles.supervisor.scope, localidadId: 2 },
  },
  // Append profiles so existing synthetic session IDs remain stable.
  cliente_torreon_acciones: structuredClone(fixtureProfiles.cliente_torreon),
};

const json = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
};
function user(key) {
  const authorization = profiles[key];
  return {
    id: Object.keys(profiles).indexOf(key) + 1,
    nombre: `Prueba ${authorization.role}`,
    rol: authorization.role,
    empresaId: authorization.scope.empresaId,
    localidadId: authorization.scope.localidadId,
    authorization,
  };
}
const envelope = (data, pageSize = 25) => ({
  success: true,
  data,
  meta: { total: data.length, page: 1, pageSize, totalPages: 1 },
});
const naturalMovements = Array.from({ length: 4 }, (_, index) => ({
  id: 700 + index,
  empresaId: 3,
  localidadId: 2,
  empresaNombreSnapshot: "Ferrocarriles de prueba",
  locomotiveNumber: `480${index}`,
  estado: index === 0 ? "EN_PROCESO" : "SOLICITADO",
  prioridad: index === 2 ? "ALTA" : "BAJA",
  viaOrigenNombreSnapshot: "Recepción 01",
  viaDestinoNombreSnapshot: "Salida 04",
  fechaSolicitud: "2026-09-17T12:00:00Z",
  fechaInicio: index === 0 ? "2026-09-17T12:30:00Z" : null,
  instrucciones: "Traslado autorizado al patio de salida.",
  rondas: [{ orden: index + 1, ronda: { numeroRonda: 8 } }],
  fotos: [],
  incidentes: [],
}));
// Mutable records belong only to the dedicated edit/cancel profile. A login resets
// this scenario, never any other profile or the read-only fixtures above.
const clientActionsKey = "cliente_torreon_acciones";
const clientActionsVias = [
  { id: 21, nombre: "Recepción 01", localidadId: 2 },
  { id: 22, nombre: "Salida 04", localidadId: 2 },
  { id: 23, nombre: "Patio de servicio", localidadId: 2 },
];
const clientActionsSections = {
  21: [{ id: 2101, numero: 1, nombre: "Entrada", viaId: 21 }],
  22: [{ id: 2201, numero: 1, nombre: "Salida", viaId: 22 }],
  23: [{ id: 2304, numero: 4, nombre: "Servicio", viaId: 23 }],
};
const clientActionsFields = new Set([
  "locomotiveNumber",
  "prioridad",
  "tipoMovimiento",
  "instrucciones",
  "poloOrigen",
  "poloDestino",
  "seccionOrigenId",
  "seccionDestinoId",
  "direccionEmpuje",
  "viaOrigenId",
  "viaDestinoId",
  "locomotoraRemolque",
]);
function initialClientActionMovements() {
  return [1700, 1701, 1702, 1703, 1704].map((id) => ({
    ...naturalMovements[1],
    id,
    empresaId: id === 1704 ? 4 : 3,
    empresaNombreSnapshot: id === 1704 ? "Empresa invitada" : "Empresa de prueba",
    clienteId: id === 1703 ? 999 : user(clientActionsKey).id,
    creadoPorId: id === 1703 ? 999 : user(clientActionsKey).id,
    locomotiveNumber: id + 4000,
    estado: id === 1700 ? "EN_PROCESO" : id === 1702 ? "ASIGNADO" : "SOLICITADO",
    fechaInicio: id === 1700 ? "2026-10-15T12:30:00Z" : null,
    fechaSolicitud: "2026-10-15T12:00:00Z",
    fechaFin: null,
    viaOrigenId: 21,
    viaDestinoId: 22,
    seccionOrigenId: 2101,
    seccionDestinoId: 2201,
    seccionOrigenNumero: 1,
    seccionDestinoNumero: 1,
    seccionOrigenNombreSnapshot: "Entrada",
    seccionDestinoNombreSnapshot: "Salida",
    poloOrigen: "NORTE",
    poloDestino: "SUR",
    tipoMovimiento: "MD_TRABAJANDO",
    direccionEmpuje: "Sin_Solicitar",
    locomotoraRemolque: null,
    instrucciones: `Indicaciones de solicitud ${id}`,
  }));
}
let clientActionMovements = initialClientActionMovements();
function clientActionUnits() {
  return [[1700], [1701, 1702], [1703], [1704]].map((ids, index) => {
    const members = clientActionMovements.filter((movement) => ids.includes(movement.id));
    const terminal = members.every((movement) =>
      ["CANCELADO", "CONCLUIDO"].includes(movement.estado),
    );
    return {
      id: 2700 + index,
      localidadId: 2,
      modalidad: ids.length > 1 ? "CONJUNTO" : "INDIVIDUAL",
      posicion: index + 1,
      estado: terminal ? "CANCELADA" : index === 0 ? "EN_PROCESO" : "PENDIENTE",
      operadorId: 17,
      operador: { id: 17, nombre: "Maquinista de prueba" },
      disponible: !terminal,
      ordenManual: index,
      fechaRecepcion: "2026-10-15T12:00:00Z",
      fechaInicio: index === 0 ? "2026-10-15T12:30:00Z" : null,
      fechaFin: terminal ? "2026-10-15T13:00:00Z" : null,
      incidentes: [],
      // Match production: cancelled members stay visible until their unit closes.
      movimientos: members,
    };
  });
}
function clientActionDetail(id) {
  const movement = clientActionMovements.find((item) => item.id === id);
  if (!movement) return null;
  const unit = clientActionUnits().find((item) => item.movimientos.some((row) => row.id === id));
  const unidad = { ...unit };
  delete unidad.movimientos;
  return { ...movement, unidad };
}
async function inputJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || "{}");
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3911");
  const key = String(request.headers.authorization || "").replace(/^Bearer e2e-/, "");
  const proxiedTorreonRead =
    request.method === "GET" &&
    url.pathname.startsWith("/torreon/") &&
    Object.hasOwn(profiles, key);
  const torreonRead = request.headers["x-service-id"] === "e2e" || proxiedTorreonRead;
  const torreonPath = proxiedTorreonRead ? url.pathname.slice("/torreon".length) : url.pathname;
  if (
    request.method === "GET" &&
    torreonRead &&
    ["/incidentes", "/arrastres/incidentes", "/catalogos/arrastre"].includes(torreonPath)
  )
    return json(response, 200, []);
  if (url.pathname === "/health") return json(response, 200, { ok: true });
  if (key === clientActionsKey && url.pathname.startsWith("/torreon/")) {
    const path = url.pathname.slice("/torreon".length);
    if (request.method === "GET" && path === "/cola") {
      const history = url.searchParams.get("historial") === "true";
      return json(
        response,
        200,
        clientActionUnits().filter(
          (unit) => ["CONCLUIDA", "CANCELADA"].includes(unit.estado) === history,
        ),
      );
    }
    if (request.method === "GET" && path === "/movimientos")
      return json(response, 200, { data: clientActionMovements });
    const match = path.match(/^\/movimientos\/(\d+)(\/cancelar)?$/);
    if (match) {
      const id = Number(match[1]),
        movement = clientActionDetail(id);
      if (!movement) return json(response, 404, { message: "Solicitud no encontrada" });
      // Return requested records even outside the session company: the real BFF
      // under test must enforce scope before forwarding a mutation.
      if (request.method === "GET" && !match[2]) return json(response, 200, movement);
      if (request.method === "PATCH") {
        const input = await inputJson(request);
        if (movement.empresaId !== 3)
          return json(response, 403, { message: "Solicitud fuera de la empresa" });
        if (!["SOLICITADO", "ASIGNADO"].includes(movement.estado) || movement.fechaInicio)
          return json(response, 409, { message: "El movimiento ya inició" });
        if (match[2]) {
          if (![movement.clienteId, movement.creadoPorId].includes(user(key).id))
            return json(response, 403, { message: "Sólo puedes cancelar solicitudes propias" });
          if (
            Object.keys(input).some((key) => key !== "razon") ||
            typeof input.razon !== "string" ||
            !input.razon.trim() ||
            input.razon.trim().length > 1000
          )
            return json(response, 400, { message: "Motivo de cancelación inválido" });
          Object.assign(
            clientActionMovements.find((item) => item.id === id),
            {
              estado: "CANCELADO",
              razonCancelacion: input.razon.trim(),
              fechaFin: "2026-10-15T13:00:00Z",
            },
          );
        } else {
          if (
            !Object.keys(input).length ||
            Object.keys(input).some((key) => !clientActionsFields.has(key))
          )
            return json(response, 400, { message: "Datos de edición inválidos" });
          const record = clientActionMovements.find((item) => item.id === id);
          Object.assign(record, input);
          for (const side of ["Origen", "Destino"]) {
            record[`via${side}NombreSnapshot`] = clientActionsVias.find(
              (via) => via.id === record[`via${side}Id`],
            )?.nombre;
            const section = clientActionsSections[record[`via${side}Id`]]?.find(
              (item) => item.id === record[`seccion${side}Id`],
            );
            record[`seccion${side}Numero`] = section?.numero ?? null;
            record[`seccion${side}NombreSnapshot`] = section?.nombre ?? null;
          }
        }
        return json(response, 200, clientActionDetail(id));
      }
    }
  }
  if (request.method === "GET" && torreonRead && torreonPath === "/cola") {
    const history = url.searchParams.get("historial") === "true";
    return json(
      response,
      200,
      naturalMovements.map((movement, index) => ({
        id: 100 + index,
        localidadId: 2,
        modalidad: "INDIVIDUAL",
        posicion: index + 1,
        estado: history ? "CONCLUIDA" : index === 0 ? "EN_PROCESO" : "PENDIENTE",
        operadorId: index === 0 ? 17 : null,
        disponible: true,
        ordenManual: null,
        fechaRecepcion: movement.fechaSolicitud,
        incidentes: [],
        movimientos: [
          {
            ...movement,
            estado: history ? "CONCLUIDO" : movement.estado,
            fechaFin: history ? "2026-09-17T13:00:00Z" : null,
          },
        ],
      })),
    );
  }
  if (request.method === "GET" && torreonRead && torreonPath === "/cola/maquinistas")
    return json(response, 200, [{ id: 17, nombre: "Maquinista de prueba" }]);
  if (request.method === "GET" && torreonRead && /^\/cola\/\d+\/historial$/.test(torreonPath))
    return json(response, 200, []);
  // Dedicated empty Torreón contract for the admin's optional locality summary.
  if (torreonPath === "/rondas" && request.method === "GET" && torreonRead)
    return json(response, 200, []);
  if (torreonPath === "/arrastres" && request.method === "GET" && torreonRead)
    return json(response, 200, arrastresPage(url.searchParams));
  if (request.method === "GET" && torreonRead && torreonPath === "/movimientos") {
    return json(response, 200, {
      data: naturalMovements,
    });
  }
  if (url.pathname === "/usuarios/login" && request.method === "POST") {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body || "{}");
      const key = String(parsed.nombre || "").toLowerCase();
      if (!Object.hasOwn(profiles, key) || parsed.contrasena !== "Prueba-COSAIF-2026")
        return json(response, 401, { error: "Credenciales de prueba inválidas" });
      if (key === clientActionsKey) clientActionMovements = initialClientActionMovements();
      return json(response, 200, {
        token: `e2e-${key}`,
        id: user(key).id,
        authorization: profiles[key],
        user: user(key),
      });
    } catch {
      return json(response, 400, { error: "Solicitud de prueba inválida" });
    }
  }
  if (!Object.hasOwn(profiles, key))
    return json(response, 401, { error: "Sesión de prueba inválida" });
  // One explicit synthetic write exercises the natural client creation boundary.
  if (
    key === "cliente_torreon" &&
    request.method === "POST" &&
    url.pathname === "/torreon/movimientos"
  ) {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body || "{}");
    if (
      input.empresaId !== 3 ||
      input.localidadId !== 2 ||
      input.creadoPorId !== user(key).id ||
      input.clienteId !== user(key).id
    )
      return json(response, 403, { error: "Creación fuera de alcance" });
    return json(response, 201, { id: 9071, ...input, estado: "SOLICITADO" });
  }
  if (request.method !== "GET")
    return json(response, 405, { error: "La API de prueba no admite escrituras" });
  if (url.pathname === "/usuarios/me")
    return json(response, 200, { authorization: profiles[key], user: user(key) });
  if (url.pathname === "/comercial/analitica") return json(response, 200, commercialAnalytics);
  if (url.pathname === "/realtime/ws-ticket")
    return json(response, 503, { error: "Realtime no se simula en esta suite" });
  if (url.pathname === "/banner/meta")
    return json(response, 200, { version: "e2e-empty", updatedAt: null });
  if (/^\/empresas(?:\/lite)?$/.test(url.pathname)) return json(response, 200, empresas);
  if (/^\/localidades(?:\/lite)?$/.test(url.pathname)) return json(response, 200, localidades);
  if (key === clientActionsKey && url.pathname === "/vias/localidad/2/lite")
    return json(response, 200, clientActionsVias);
  if (key === clientActionsKey && /^\/secciones\/secciones\/via\/\d+$/.test(url.pathname))
    return json(response, 200, clientActionsSections[Number(url.pathname.split("/").at(-1))] ?? []);
  if (key === "cliente_torreon" && url.pathname === "/vias/localidad/2")
    return json(response, 200, [
      { id: 21, nombre: "Recepción" },
      { id: 22, nombre: "Salida" },
    ]);
  if (/^\/rondas(?:\/localidad\/\d+\/estado\/(?:true|false))?$/.test(url.pathname)) {
    return json(
      response,
      200,
      rondas.filter(
        (row) =>
          inRequestedScope(row, url.searchParams) &&
          row.concluido === (url.searchParams.get("concluido") === "true"),
      ),
    );
  }
  if (url.pathname === "/movimientos/buscar") {
    const history = url.searchParams.get("ambito") === "pasados";
    return json(
      response,
      200,
      envelope(
        movimientos.filter(
          (row) =>
            inRequestedScope(row, url.searchParams) && (row.estado === "CONCLUIDO") === history,
        ),
      ),
    );
  }
  // Explicit empty contracts for auxiliary modules. Unknown endpoints fail visibly.
  if (
    ["/incidentes", "/actualizaciones", "/usuarios", "/torno/rondas-servicio/historial"].includes(
      url.pathname,
    )
  )
    return json(response, 200, envelope([]));
  return json(response, 501, {
    error: `Contrato de prueba no definido: ${request.method} ${url.pathname}`,
  });
});
server.listen(3911, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
