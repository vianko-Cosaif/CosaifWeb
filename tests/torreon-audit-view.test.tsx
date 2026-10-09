// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TorreonNaturalQueue from "@/features/torreon/naturales/components/TorreonNaturalQueue";
import { auditEventView, uniqueAuditEvents } from "@/features/torreon/naturales/auditView";
import { dateLabel, type QueueAudit, type QueueUnit } from "@/features/torreon/naturales/queueView";

vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({ useRealtimeBoardRefresh() {} }));
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const group: QueueUnit = {
  id: 3,
  modalidad: "CONJUNTO",
  estado: "PENDIENTE",
  posicion: 1,
  ordenManual: -2,
  operadorId: null,
  disponible: true,
  totalIntegrantes: 2,
  incidentes: [],
  movimientos: [
    {
      id: 1,
      empresaId: 3,
      locomotiveNumber: 12345,
      estado: "SOLICITADO",
      coordinadorId: 99,
      coordinador: { id: 99, nombre: "María Cruz" },
    },
    { id: 2, empresaId: 3, locomotiveNumber: 789, estado: "SOLICITADO" },
  ],
};
const names = new Map([[99, "María Cruz"]]);
const firstMigration: QueueAudit = {
  id: 3,
  unidadId: 1,
  movimientoId: 1,
  usuarioId: 0,
  rol: "SISTEMA",
  accion: "MIGRAR_MODELO",
  fecha: "2026-10-08T22:00:00.000Z",
  datos: { estadoOriginal: "SOLICITADO", operadorId: null },
};
const secondMigration: QueueAudit = { ...firstMigration, id: 4, unidadId: 2, movimientoId: 2 };
const firstPriority: QueueAudit = {
  id: 11,
  unidadId: 3,
  usuarioId: 99,
  rol: "COORDINADOR",
  accion: "PRIORIZAR",
  fecha: "2026-10-08T22:15:00.000Z",
  datos: { ordenManual: -1, modalidad: "CONJUNTO" },
};
const secondPriority: QueueAudit = {
  ...firstPriority,
  id: 15,
  fecha: "2026-10-08T22:15:58.000Z",
  datos: { ordenManual: -2, modalidad: "CONJUNTO" },
};
const history = [
  firstMigration,
  secondMigration,
  firstPriority,
  { ...firstPriority },
  secondPriority,
];
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("describes both simultaneous system migrations with their distinct locomotives", () => {
  const first = auditEventView(firstMigration, group, names);
  const second = auditEventView(secondMigration, group, names);
  expect(first.actor).toBe("Sistema");
  expect(second.actor).toBe("Sistema");
  expect(first.title).not.toContain("MIGRAR_MODELO");
  expect(first.title).toBeTruthy();
  expect(first.target).toContain("#1");
  expect(first.target).toContain("12345");
  expect(second.target).toContain("#2");
  expect(second.target).toContain("789");
  expect(uniqueAuditEvents([firstMigration, secondMigration])).toHaveLength(2);
});

it("removes repeated event ids while preserving real priority changes in the same minute", () => {
  const entries = uniqueAuditEvents(history);
  expect(entries.map((entry) => entry.id)).toEqual([3, 4, 11, 15]);
  expect(entries.filter((entry) => entry.accion === "PRIORIZAR")).toHaveLength(2);
  expect(dateLabel(firstPriority.fecha, { seconds: true })).toContain("16:15:00");
  expect(dateLabel(secondPriority.fecha, { seconds: true })).toContain("16:15:58");
});

it("resolves the responsible person from the available user names", () => {
  const event = auditEventView(firstPriority, group, names);
  expect(event.actor).toContain("María Cruz");
  expect(event.actor).not.toContain("Usuario #99");
});

it("limits movement targets in grouped audit data to the members visible for this company", () => {
  const scopedGroup: QueueUnit = { ...group, movimientos: [group.movimientos[0]] };
  const event: QueueAudit = {
    id: 18,
    unidadId: 3,
    usuarioId: 99,
    rol: "COORDINADOR",
    accion: "FORMAR_CONJUNTO",
    fecha: firstPriority.fecha,
    datos: { movimientoIds: [1, 999], unidadesOrigen: [1, 20] },
  };
  const view = auditEventView(event, scopedGroup, names);
  expect(view.target).toContain("12345");
  expect(view.target).not.toContain("999");
  expect(view.target).not.toContain("789");
});

it("renders a readable audit timeline with system actors, movement targets and distinct seconds", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => json(url.endsWith("/historial") ? history : [group])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  fireEvent.click(await screen.findByRole("button", { name: "Ver detalle del movimiento 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver historial de operación" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText(/16:15:58/);
  const entries = within(dialog).getAllByRole("listitem");
  expect(entries).toHaveLength(4);
  for (const [index, locomotive] of [
    [0, "12345"],
    [1, "789"],
  ] as const) {
    expect(within(entries[index]).getByText("Sistema")).toBeTruthy();
    expect(entries[index].textContent).toContain(locomotive);
  }
  expect(within(dialog).queryByText("MIGRAR MODELO")).toBeNull();
  expect(within(dialog).queryByText(/Usuario #0/)).toBeNull();
  expect(within(dialog).getAllByText("Prioridad actualizada")).toHaveLength(2);
  expect(entries[2].textContent).toContain("María Cruz");
  expect(entries[3].textContent).toContain("María Cruz");
  expect(entries[2].textContent).toContain("16:15:00");
  expect(entries[3].textContent).toContain("16:15:58");
});
