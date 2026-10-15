import { expect, test, type Page } from "@playwright/test";

const movementPath = (id: number, action = "edicion") =>
  `/api/cliente/torreon/movimientos/${id}/${action}`;

// Browser requests exercise the real session, BFF scope checks and upstream proxy.
async function request(page: Page, path: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    },
    { path, method, body },
  );
}

async function login(page: Page, username = "cliente_torreon_acciones") {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(/\/cliente$/);
  await page.goto("/cliente/movimientos");
}
const row = (page: Page, id: number) => page.locator(`tr[data-row-key="${id}"]`);

async function cancel(page: Page, id: number, reason: string) {
  await page.getByRole("button", { name: `Cancelar movimiento ${id}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Cancelar solicitud #${id}` });
  await dialog.getByRole("textbox", { name: "Motivo de cancelación" }).fill(reason);
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(movementPath(id, "cancelar")) &&
      response.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: "Confirmar cancelación" }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect(result.request().postDataJSON()).toEqual({ razon: reason.trim() });
  await expect(dialog).toHaveCount(0);
}

test("Torreón: edita un miembro y conserva su conjunto, maquinista y otra solicitud", async ({
  page,
}) => {
  await login(page);
  const sibling = await request(page, movementPath(1702));
  expect(sibling.status).toBe(200);
  await page.getByRole("link", { name: "Editar movimiento 1701", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editar movimiento #1701" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Instrucciones", exact: true })
    .fill("Ruta corregida sólo para la solicitud 1701");
  await page.getByRole("combobox", { name: "Vía de destino", exact: true }).selectOption("23");
  await page.getByRole("combobox", { name: "Polo de llegada", exact: true }).selectOption("CENTRO");
  await expect(
    page
      .getByRole("combobox", { name: "Sección de destino", exact: true })
      .getByRole("option", { name: "Sección 4 · Servicio" }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Sección de destino", exact: true })
    .selectOption("2304");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(movementPath(1701)) && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  const savedResponse = await saved;
  expect(savedResponse.status()).toBe(200);
  expect(savedResponse.request().postDataJSON()).toEqual({
    instrucciones: "Ruta corregida sólo para la solicitud 1701",
    viaDestinoId: 23,
    seccionDestinoId: 2304,
    poloDestino: "CENTRO",
  });
  await expect(page).toHaveURL(/\/cliente\/movimientos\?loc=2$/);
  await expect(row(page, 1701)).toContainText("Patio de servicio");
  expect((await request(page, movementPath(1702))).data).toEqual(sibling.data);
  const updated = (await request(page, movementPath(1701))).data;
  expect(updated).toMatchObject({
    estado: "SOLICITADO",
    viaDestinoId: 23,
    seccionDestinoId: 2304,
    unidad: {
      id: 2701,
      modalidad: "CONJUNTO",
      estado: "PENDIENTE",
      operadorId: 17,
      ordenManual: 1,
    },
  });
});

test("Torreón en pantalla pequeña: motivo y confirmación, conserva solicitud y cancela miembros sin alterar al hermano", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH") writes.push(request.url());
  });
  await page.getByRole("button", { name: "Cancelar movimiento 1701", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Cancelar solicitud #1701" });
  await expect(dialog).toContainText("Las demás solicitudes del conjunto continuarán en la cola.");
  await expect(dialog.getByRole("button", { name: "Confirmar cancelación" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Motivo de cancelación" }).fill("   ");
  await expect(dialog.getByRole("button", { name: "Confirmar cancelación" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Conservar solicitud" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
  const sibling = (await request(page, movementPath(1702))).data;
  await cancel(page, 1701, "  Solicitud duplicada  ");
  await expect(row(page, 1701)).toHaveCount(0);
  expect((await request(page, movementPath(1701))).data).toMatchObject({
    estado: "CANCELADO",
    razonCancelacion: "Solicitud duplicada",
    unidad: { id: 2701, estado: "PENDIENTE" },
  });
  expect(
    (await request(page, movementPath(1701, "cancelar"), "PATCH", { razon: "Intento repetido" }))
      .status,
  ).toBe(409);
  const activeQueue = (await request(page, "/bff/torreon/cola?localidadId=2")).data;
  expect(activeQueue.find((unit: { id: number }) => unit.id === 2701)).toMatchObject({
    estado: "PENDIENTE",
    movimientos: [
      expect.objectContaining({ id: 1701, estado: "CANCELADO" }),
      expect.objectContaining({ id: 1702, estado: "ASIGNADO" }),
    ],
  });
  await expect(
    page.getByRole("button", { name: "Cancelar movimiento 1701", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Editar movimiento 1701", exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Cancelar movimiento 1702", exact: true }),
  ).toBeVisible();
  expect((await request(page, movementPath(1702))).data).toEqual(sibling);
  expect(writes).toHaveLength(2);
  await page.screenshot({
    path: testInfo.outputPath("torreon-miembro-cancelado-hermano-activo.png"),
  });

  await cancel(page, 1702, "Ya no se requiere la segunda solicitud");
  await expect(row(page, 1701)).toHaveCount(0);
  await expect(row(page, 1702)).toHaveCount(0);
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await expect(row(page, 1701)).toContainText(/cancelado/i);
  await expect(row(page, 1702)).toContainText(/cancelado/i);
  await expect(page.getByRole("link", { name: /^Editar movimiento / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Cancelar movimiento / })).toHaveCount(0);
  expect(writes).toHaveLength(3);
});

test("Torreón: respeta empresa, autoría y estado en pantalla y rutas protegidas", async ({
  page,
}) => {
  await login(page);
  for (const id of [1700, 1703, 1704, 1705]) {
    await expect(row(page, id)).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Editar movimiento ${id}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Cancelar movimiento ${id}`, exact: true }),
    ).toHaveCount(0);
  }
  expect((await request(page, movementPath(1704))).status).toBe(403);
  expect(
    (await request(page, movementPath(1704), "PATCH", { instrucciones: "Fuera de empresa" }))
      .status,
  ).toBe(403);
  expect(
    (await request(page, movementPath(1703, "cancelar"), "PATCH", { razon: "Otro creador" }))
      .status,
  ).toBe(403);
  expect((await request(page, movementPath(1703))).status).toBe(403);
  expect(
    (await request(page, movementPath(1703), "PATCH", { instrucciones: "Otro creador" })).status,
  ).toBe(403);
  for (const id of [1700, 1705, 1706, 1707]) {
    expect(
      (await request(page, movementPath(id), "PATCH", { instrucciones: "Estado protegido" }))
        .status,
    ).toBe(409);
    expect(
      (await request(page, movementPath(id, "cancelar"), "PATCH", { razon: "Estado protegido" }))
        .status,
    ).toBe(409);
  }
  expect((await request(page, movementPath(1701), "PATCH", { empresaId: 4 })).status).toBe(400);
  expect(
    (await request(page, movementPath(1701, "cancelar"), "PATCH", { razon: " " })).status,
  ).toBe(400);
});

test("Guadalajara conserva su seguimiento y no solicita las nuevas acciones de Torreón", async ({
  page,
}) => {
  const torreonRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/cliente\/torreon\/movimientos\/\d+/.test(request.url()))
      torreonRequests.push(request.url());
  });
  await login(page, "cliente_gdl_regresion");
  await expect(page.getByText("FXE-1101", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("FXE-1102", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Editar movimiento 170/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Cancelar movimiento 170/ })).toHaveCount(0);
  await page.locator('[data-movements-scope="pasados"]').click();
  await expect(page.getByText("FXE-2101", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("FXE-2102", { exact: true })).toHaveCount(0);
  expect(torreonRequests).toEqual([]);
});
