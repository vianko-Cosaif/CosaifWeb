import { expect, test, type Page } from "@playwright/test";

// Browser fetch preserves the Secure session cookie on loopback, just like the UI.
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

test("cliente natural de Torreón conserva su inicio y crea sólo para su empresa", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("cliente_torreon");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(/\/cliente$/);
  await expect(page.getByRole("link", { name: "Crear movimiento", exact: true })).toBeVisible();
  await expect(page.getByText("Solicitar arrastre", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Mis arrastres", { exact: true })).toHaveCount(0);
  await page.goto("/cliente/torreon");
  await expect(page).toHaveURL(/\/cliente$/);
  await page.getByRole("link", { name: "Crear movimiento", exact: true }).click();
  await expect(page).toHaveURL(/\/movimientos\/crear$/);
  await expect(page.getByRole("textbox", { name: "Empresa", exact: true })).toHaveValue(
    "Empresa de prueba",
  );
  await expect(page.getByRole("textbox", { name: "Empresa", exact: true })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Localidad", exact: true })).toBeDisabled();
  await expect(page.getByText(/application error/i)).toHaveCount(0);

  const response = await request(page, "/bff/torreon/movimientos", "POST", {
    empresaId: 999,
    localidadId: 999,
    clienteId: 999,
    creadoPorId: 999,
    locomotiveNumber: "4800",
    instrucciones: "Solicitud natural sintética",
  });
  expect(response.status).toBe(201);
  expect(response.data).toMatchObject({
    empresaId: 3,
    localidadId: 2,
    estado: "SOLICITADO",
  });
  expect((await request(page, "/api/cliente/torreon/arrastres?localidadId=2")).status).toBe(403);
  expect((await request(page, "/bff/torreon/arrastres", "POST", {})).status).toBe(403);
  await page.goto("/cliente/torreon/crear");
  await expect(page).toHaveURL(/\/movimientos\/crear$/);
});

test("cliente arrastre sólo accede a arrastres y no puede iniciar ni finalizar vagones", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("arrastre");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(/\/cliente\/torreon$/);
  await expect(page.getByRole("button", { name: "Solicitar arrastre", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear movimiento", exact: true })).toHaveCount(0);
  expect((await request(page, "/bff/torreon/movimientos", "POST", {})).status).toBe(403);
  expect((await request(page, "/api/cliente/rondas?localidadId=2")).status).toBe(403);
  for (const operation of ["iniciar", "finalizar"])
    expect(
      (await request(page, `/bff/torreon/arrastres/1/vagones/1/${operation}`, "PATCH", {})).status,
    ).toBe(403);
  await page.goto("/movimientos/crear");
  await expect(page).toHaveURL(/\/cliente\/torreon\/crear$/);
});
