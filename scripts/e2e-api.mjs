import { createServer } from "node:http";
import { arrastresPage } from "../e2e/fixtures/arrastres.mjs";
import profiles from "../e2e/fixtures/authorization.json" with { type: "json" };
import {
  empresas,
  localidades,
  movimientos,
  rondas,
  inRequestedScope,
  commercialAnalytics,
} from "../e2e/fixtures/operations.mjs";

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
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3911");
  if (
    request.method === "GET" &&
    request.headers["x-service-id"] === "e2e" &&
    ["/incidentes", "/arrastres/incidentes"].includes(url.pathname)
  )
    return json(response, 200, []);
  if (url.pathname === "/health") return json(response, 200, { ok: true });
  // Dedicated empty Torreón contract for the admin's optional locality summary.
  if (
    url.pathname === "/rondas" &&
    request.method === "GET" &&
    request.headers["x-service-id"] === "e2e"
  )
    return json(response, 200, []);
  if (
    url.pathname === "/arrastres" &&
    request.method === "GET" &&
    request.headers["x-service-id"] === "e2e"
  )
    return json(response, 200, arrastresPage(url.searchParams));
  if (
    request.method === "GET" &&
    request.headers["x-service-id"] === "e2e" &&
    url.pathname === "/movimientos"
  ) {
    return json(response, 200, {
      data: Array.from({ length: 4 }, (_, index) => ({
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
      })),
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
  const key = String(request.headers.authorization || "").replace(/^Bearer e2e-/, "");
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
