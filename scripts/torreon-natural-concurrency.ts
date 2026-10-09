/**
 * Prueba manual con datos reales: crea exactamente 20 movimientos naturales.
 * Requiere Node 24 y la aplicación levantada. No ejecutar contra producción sin intención expresa.
 *
 * PowerShell:
 *   $env:TORREON_TEST_PASSWORD = '<contraseña compartida>'
 *   $env:TORREON_TEST_BASE_URL = 'http://localhost:3012' # opcional
 *   node scripts/torreon-natural-concurrency.ts --preflight # sólo lecturas
 *   node scripts/torreon-natural-concurrency.ts
 */
import { randomInt, randomUUID } from "node:crypto";
import { request, type APIRequestContext } from "@playwright/test";

const USERS = ["ctorreon", "ctorreon2", "ctorreon3", "ctorreon4"] as const;
const TOTAL = 20;
const BASE_URL = process.env.TORREON_TEST_BASE_URL ?? "http://localhost:3012";
const PASSWORD = process.env.TORREON_TEST_PASSWORD;

type Session = { user: { id: number; empresaId: number; localidadId: number; rol: string } };
type Via = { id: number; nombre: string };
type Section = { id: number; numero: number; nombre?: string | null };
type Client = { name: string; api: APIRequestContext; session: Session["user"] };
type PlannedBatch = { client: Client; atMs: number; numbers: number[] };
type Movement = { id?: number; locomotiveNumber?: number | string; locomotora?: number | string; estado?: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const wrapper = record(value);
  for (const key of ["items", "data", "rows", "vias", "secciones", "movimientos"]) {
    if (Array.isArray(wrapper[key])) return wrapper[key] as unknown[];
  }
  throw new Error("El servidor devolvió una colección con formato desconocido.");
}

async function json(api: APIRequestContext, path: string, options?: Parameters<APIRequestContext["get"]>[1]): Promise<unknown> {
  const response = await api.get(path, options);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok()) {
    const error = record(data);
    throw new Error(`GET ${path}: HTTP ${response.status()} - ${String(error.message ?? error.error ?? "sin detalle")}`);
  }
  return data;
}

function positiveId(value: unknown, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} inválido: ${String(value)}`);
  return id;
}

function randomChoice<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(name: string): Promise<Client> {
  const api = await request.newContext({ baseURL: BASE_URL, timeout: 20_000 });
  try {
    const response = await api.post("/bff/login", { data: { nombre: name, contrasena: PASSWORD } });
    if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    const session = record(await json(api, "/api/auth/session"));
    const user = record(session.user);
    const parsed: Session["user"] = {
      id: positiveId(user.id, `${name}: usuario`),
      empresaId: positiveId(user.empresaId, `${name}: empresa`),
      localidadId: positiveId(user.localidadId, `${name}: localidad`),
      rol: String(user.rol ?? ""),
    };
    if (!["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(parsed.rol)) {
      throw new Error(`${name} no tiene perfil de cliente natural.`);
    }
    return { name, api, session: parsed };
  } catch (error) {
    await api.dispose();
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadRoutes(client: Client): Promise<{ via: Via; section: Section }[]> {
  const locality = client.session.localidadId;
  const rawVias = rows(await json(client.api, `/bff/vias/localidad/${locality}/lite`));
  const vias = rawVias.map((item) => {
    const value = record(item);
    return { id: Number(value.id), nombre: String(value.nombre ?? "").trim() };
  }).filter((via) => Number.isSafeInteger(via.id) && via.id > 0 && via.nombre);
  const sections = await Promise.all(vias.map(async (via) => {
    const data = rows(await json(client.api, `/bff/secciones/secciones/via/${via.id}`));
    return data.map((item) => {
      const value = record(item);
      return { via, section: { id: Number(value.id), numero: Number(value.numero), nombre: typeof value.nombre === "string" ? value.nombre : null } };
    }).filter(({ section }) => Number.isSafeInteger(section.id) && section.id > 0);
  }));
  const points = sections.flat();
  if (points.length < 2 || new Set(points.map(({ via }) => via.id)).size < 2) {
    throw new Error(`${client.name}: se requieren dos vías con secciones válidas en Torreón.`);
  }
  return points;
}

function locomotiveNumber(value: unknown): number | null {
  const movement = record(value);
  const number = Number(movement.locomotiveNumber ?? movement.locomotora);
  return Number.isSafeInteger(number) && number >= 1000 && number <= 9999 ? number : null;
}

async function occupiedNumbers(clients: Client[]): Promise<Set<number>> {
  const locality = clients[0].session.localidadId;
  const query = new URLSearchParams({ localidadId: String(locality), estado: "pendientes", entity: "movimientos", alcance: "localidad" });
  // Es la misma lectura que usa la vista "Actuales" del cliente, compartida por localidad.
  const [rounds, ...queues] = await Promise.all([
    json(clients[0].api, `/api/cliente/rondas?${query}`),
    ...clients.map((client) => json(client.api, `/bff/torreon/cola?localidadId=${locality}&historial=false`)),
  ]);
  const occupied = new Set<number>();
  for (const round of rows(rounds)) {
    const number = locomotiveNumber(record(round).movimiento);
    if (number !== null) occupied.add(number);
  }
  for (const queue of queues) {
    for (const unit of rows(queue)) {
      const movements = record(unit).movimientos;
      if (!Array.isArray(movements)) throw new Error("La cola de Torreón devolvió una unidad sin movimientos válidos.");
      for (const movement of movements) {
        const number = locomotiveNumber(movement);
        if (number !== null) occupied.add(number);
      }
    }
  }
  return occupied;
}

function pickNumbers(occupied: ReadonlySet<number>): number[] {
  const selected = new Set<number>();
  let attempts = 0;
  while (selected.size < TOTAL && attempts++ < 1000) {
    const number = randomInt(1000, 10000);
    if (!selected.has(number) && !occupied.has(number)) selected.add(number);
  }
  if (selected.size !== TOTAL) throw new Error("No se encontraron 20 locomotoras de cuatro dígitos libres.");
  return [...selected];
}

function batchSizes(): number[] {
  const sizes = Array<number>(8).fill(1);
  let remaining = TOTAL - sizes.length;
  while (remaining > 0) {
    const index = randomInt(sizes.length);
    if (sizes[index] < 5) { sizes[index]++; remaining--; }
  }
  return sizes;
}

function makeMovement(client: Client, number: number, points: { via: Via; section: Section }[]) {
  const origin = randomChoice(points);
  const destination = randomChoice(points.filter((point) => point.via.id !== origin.via.id));
  return {
    locomotiveNumber: number,
    localidadId: client.session.localidadId,
    empresaId: client.session.empresaId,
    creadoPorId: client.session.id,
    viaOrigenId: origin.via.id,
    viaDestinoId: destination.via.id,
    seccionOrigenId: origin.section.id,
    seccionDestinoId: destination.section.id,
    viaOrigenNombreSnapshot: origin.via.nombre,
    viaDestinoNombreSnapshot: destination.via.nombre,
    seccionOrigenNombreSnapshot: origin.section.nombre || `Sección ${origin.section.numero}`,
    seccionDestinoNombreSnapshot: destination.section.nombre || `Sección ${destination.section.numero}`,
    polo: randomChoice(["NORTE", "SUR"]),
    posicionChimenea: randomChoice(["DENTRO", "AFUERA", "Sin_Solicitar"]),
    posicionCabina: randomChoice(["DENTRO", "AFUERA", "Sin_Solicitar"]),
    tipoMovimiento: "MD_TRABAJANDO",
    direccionEmpuje: "Sin_Solicitar",
    instrucciones: `Prueba de concurrencia ${number}`,
    // Sin lavado, torno ni otro servicio activo.
  };
}

async function sendBatch(batch: PlannedBatch, points: { via: Via; section: Section }[]): Promise<void> {
  const { client, numbers } = batch;
  const started = Date.now();
  const response = await client.api.post("/bff/torreon/movimientos/lote", {
    data: { clientRequestId: randomUUID(), movimientos: numbers.map((number) => makeMovement(client, number, points)) },
    timeout: 30_000,
  });
  if (!response.ok()) {
    const body = record(await response.json().catch(() => null));
    throw new Error(`${client.name}: lote ${numbers.join(", ")} rechazado (HTTP ${response.status()}): ${String(body.message ?? body.error ?? "sin detalle")}`);
  }
  console.log(`${client.name}: ${numbers.length} enviados [${numbers.join(", ")}] en ${Date.now() - started} ms`);
}

async function verify(clients: Client[], batches: PlannedBatch[]): Promise<void> {
  const expectedByClient = new Map(clients.map((client) => [client.name, batches.filter((batch) => batch.client === client).flatMap((batch) => batch.numbers)]));
  for (let attempt = 1; attempt <= 6; attempt++) {
    const issues: string[] = [];
    for (const client of clients) {
      const data = rows(await json(client.api, `/bff/torreon/cola?localidadId=${client.session.localidadId}&historial=false`));
      const movements: Movement[] = data.flatMap((unit) => {
        const items = record(unit).movimientos;
        return Array.isArray(items) ? items as Movement[] : [];
      });
      for (const number of expectedByClient.get(client.name) ?? []) {
        const count = movements.filter((movement) => Number(movement.locomotiveNumber ?? movement.locomotora) === number).length;
        if (count !== 1) issues.push(`${client.name}: locomotora ${number}, encontrados ${count}`);
      }
    }
    if (!issues.length) {
      console.log(`Verificación final: ${TOTAL} locomotoras únicas presentes en las colas de sus clientes.`);
      return;
    }
    if (attempt === 6) throw new Error(`No se confirmaron los ${TOTAL} movimientos: ${issues.join("; ")}`);
    await sleep(1000);
  }
}

async function main(): Promise<void> {
  if (!PASSWORD) throw new Error("Define TORREON_TEST_PASSWORD antes de ejecutar.");
  const clients: Client[] = [];
  try {
    for (const name of USERS) clients.push(await login(name));
    const locality = clients[0].session.localidadId;
    if (clients.some((client) => client.session.localidadId !== locality)) {
      throw new Error("Los cuatro clientes deben pertenecer a la misma localidad de Torreón.");
    }
    const points = await loadRoutes(clients[0]);
    const occupied = await occupiedNumbers(clients);
    const numbers = pickNumbers(occupied);
    const sizes = batchSizes();
    const schedule = [
      { user: 0, atMs: 0 }, { user: 1, atMs: 3000 },
      { user: 2, atMs: 3050 }, { user: 3, atMs: 3100 },
      { user: 0, atMs: 6000 }, { user: 2, atMs: 6050 },
      { user: 1, atMs: 9000 }, { user: 3, atMs: 9050 },
    ];
    let offset = 0;
    const batches = schedule.map((slot, index): PlannedBatch => {
      const batch = { client: clients[slot.user], atMs: slot.atMs, numbers: numbers.slice(offset, offset + sizes[index]) };
      offset += sizes[index];
      return batch;
    });
    console.log(`Plan: ${batches.map((batch) => `${batch.client.name} +${batch.atMs}ms (${batch.numbers.length})`).join(" | ")}`);
    console.log(`Revisión previa: ${occupied.size} locomotoras ocupadas de cuatro dígitos en las colas visibles.`);
    if (process.argv.includes("--preflight")) {
      console.log("Preflight completo: no se enviaron movimientos.");
      return;
    }
    const start = Date.now();
    const results = await Promise.allSettled(batches.map(async (batch) => {
      await sleep(Math.max(0, start + batch.atMs - Date.now()));
      await sendBatch(batch, points);
    }));
    const failures = results.flatMap((result) => result.status === "rejected" ? [String(result.reason)] : []);
    if (failures.length) throw new Error(`Fallaron ${failures.length} de ${batches.length} lotes:\n${failures.join("\n")}`);
    await verify(clients, batches);
  } finally {
    await Promise.all(clients.map((client) => client.api.dispose()));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
