// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CatalogosOperativosPageClient from "@/features/catalogos-operativos/CatalogosOperativosPageClient";
import { TorreonArrastreYardManager } from "@/features/catalogos-operativos/components/TorreonArrastreYardManager";

const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function naturalCatalog() {
  return {
    localidades: [
      {
        id: 2,
        nombre: "Torreón",
        estado: "ACTIVA",
        totalVias: 1,
        totalSecciones: 2,
        torno: { configurado: false, navaId: null, cantidadNavajas: 0 },
        vias: [
          {
            id: 11,
            numero: 5,
            nombre: "Vía 5",
            secciones: [
              { id: 101, numero: 1, nombre: "Entrada", ocupada: true, movimientoId: 500 },
              { id: 103, numero: 3, nombre: "Salida norte", ocupada: true, movimientoId: 501 },
            ],
          },
        ],
      },
    ],
    warnings: [],
  };
}

it("saves an occupied natural section's name, preserves the other name and nonconsecutive numbers, and reads the saved names", async () => {
  const catalog = naturalCatalog();
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      const payload = JSON.parse(String(options.body));
      const plan = payload.vias[0].seccionesDetalle;
      catalog.localidades[0].vias[0].secciones.forEach((section) => {
        section.nombre = plan.find(
          (item: { numero: number }) => item.numero === section.numero,
        ).nombre;
      });
      return json({ localidad: catalog.localidades[0], warnings: [] });
    }
    return json(catalog);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<CatalogosOperativosPageClient />);
  fireEvent.click(await screen.findByRole("button", { name: /Torreón.*ID 2/ }));
  fireEvent.click(screen.getByText("Nombres de secciones · Vía 5 (2)"));
  expect(screen.getByLabelText("Nombre de sección 3 en Vía 5")).toHaveProperty(
    "value",
    "Salida norte",
  );
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Nombre de sección 1 en Vía 5"), {
    target: { value: "Entrada al taller" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Cambios guardados correctamente");
  const post = fetcher.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(JSON.parse(String(post[1]!.body))).toMatchObject({
    localidad: { id: 2 },
    vias: [
      {
        id: 11,
        secciones: 2,
        seccionesDetalle: [
          { numero: 1, nombre: "Entrada al taller" },
          { numero: 3, nombre: "Salida norte" },
        ],
      },
    ],
  });
  expect(screen.getByLabelText("Nombre de sección 1 en Vía 5")).toHaveProperty(
    "value",
    "Entrada al taller",
  );
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toHaveProperty("disabled", true);
});

it("adds a natural section without replacing existing names or section numbers", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json(naturalCatalog())),
  );
  render(<CatalogosOperativosPageClient />);
  fireEvent.click(await screen.findByRole("button", { name: /Torreón.*ID 2/ }));
  fireEvent.change(screen.getByLabelText("Secciones de vía 5"), { target: { value: "3" } });
  fireEvent.click(screen.getByText("Nombres de secciones · Vía 5 (3)"));
  expect(screen.getByLabelText("Nombre de sección 1 en Vía 5")).toHaveProperty("value", "Entrada");
  expect(screen.getByLabelText("Nombre de sección 3 en Vía 5")).toHaveProperty(
    "value",
    "Salida norte",
  );
  expect(screen.getByLabelText("Nombre de sección 4 en Vía 5")).toHaveProperty(
    "value",
    "Sección 4",
  );
});

it("rejects an empty section name and retains the draft without sending a save", async () => {
  const fetcher = vi.fn(async () => json(naturalCatalog()));
  vi.stubGlobal("fetch", fetcher);
  render(<CatalogosOperativosPageClient />);
  fireEvent.click(await screen.findByRole("button", { name: /Torreón.*ID 2/ }));
  fireEvent.click(screen.getByText("Nombres de secciones · Vía 5 (2)"));
  fireEvent.change(screen.getByLabelText("Nombre de sección 1 en Vía 5"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Captura el nombre de cada sección de la vía 5.");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Nombre de sección 3 en Vía 5")).toHaveProperty(
    "value",
    "Salida norte",
  );
});

it("edits arrastre section names without replacing IDs or altering the natural yard", async () => {
  vi.stubEnv("NEXT_PUBLIC_TORREON_LOCALIDAD_IDS", "2");
  const tracks = [
    {
      id: 21,
      numero: 4,
      nombre: "Vía Arrastre 4",
      secciones: [
        { id: 701, numero: 1, nombre: "Carga" },
        { id: 703, numero: 3, nombre: "Descarga" },
      ],
    },
  ];
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "POST") return json(JSON.parse(String(options.body)).vias);
    return json(tracks);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonArrastreYardManager />);
  fireEvent.click(await screen.findByText("Nombres de secciones · Vía Arrastre 4 (2)"));
  fireEvent.change(screen.getByLabelText("Nombre de sección 3 en Vía Arrastre 4"), {
    target: { value: "Descarga de material" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar patio de Arrastre" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true),
  );
  const post = fetcher.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(post[0]).toBe("/api/torreon/arrastre-catalogo");
  expect(JSON.parse(String(post[1]!.body))).toMatchObject({
    localidadId: 2,
    vias: [
      {
        id: 21,
        secciones: [
          { id: 701, numero: 1, nombre: "Carga" },
          { id: 703, numero: 3, nombre: "Descarga de material" },
        ],
      },
    ],
  });
  await screen.findByText(
    "Patio de Arrastre guardado. Estas vías ya están disponibles en las solicitudes de Torreón.",
  );
});
