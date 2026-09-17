import { expect, test, type Page } from "@playwright/test";

// Use Chromium's same-origin cookie handling, including Secure cookies on loopback.
async function read(page: Page, path: string, method = "GET") {
  return page.evaluate(
    async ({ path, method }) => {
      const response = await fetch(path, { method, credentials: "same-origin" });
      return { status: response.status, data: await response.json() };
    },
    { path, method },
  );
}

async function login(page: Page, username = "cliente") {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(
    username === "comercial" ? /\/comercial\/reporte-general$/ : new RegExp(`/${username}$`),
  );
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

test("cliente: actuales de todas las empresas locales; historial de su empresa y localidad", async ({
  page,
}, testInfo) => {
  await login(page);
  // Start timing only once the authenticated navigation is ready.
  await expect(page.getByText("Acceso verificado", { exact: true })).toBeVisible();
  const started = performance.now();
  await page
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: "Seguimiento", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cliente\/movimientos$/);
  await expect(page.getByText("FXE-1101", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("FXE-1102", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("FXE-1103", { exact: true })).toHaveCount(0);
  const currentMs = Math.round(performance.now() - started);
  const switched = performance.now();
  await page.locator('[data-movements-scope="pasados"]').click();
  await expect(page.getByText("FXE-2101", { exact: true }).first()).toBeVisible();
  for (const id of [1101, 1102, 2102, 2103])
    await expect(page.getByText(`FXE-${id}`, { exact: true })).toHaveCount(0);
  await testInfo.attach("movements-timing.json", {
    body: JSON.stringify({
      currentMs,
      historySwitchMs: Math.round(performance.now() - switched),
      backend: "synthetic-local",
    }),
    contentType: "application/json",
  });
  await page.locator('[data-movements-scope="actuales"]').click();
  await expect(page.getByText("FXE-1102", { exact: true }).first()).toBeVisible();
});

test("la sesión real del navegador bloquea filtros manipulados y protege instrucciones ajenas", async ({
  page,
}) => {
  await login(page);
  for (const path of [
    "/api/cliente/rondas?localidadId=2&alcance=localidad",
    "/bff/movimientos/buscar?empresaId=4&ambito=pasados",
  ]) {
    expect((await read(page, path)).status).toBe(403);
  }
  const current = await read(page, "/api/cliente/rondas?localidadId=1&alcance=localidad");
  expect(current.status).toBe(200);
  const rows = current.data;
  expect(rows.map((row: { movimiento: { id: number } }) => row.movimiento.id).sort()).toEqual([
    1101, 1102,
  ]);
  expect(JSON.stringify(rows)).not.toContain("Instrucción privada 1102");
  const history = await read(page, "/bff/movimientos/buscar?ambito=pasados&alcance=localidad");
  expect(history.status).toBe(200);
  expect(history.data.data.map((row: { id: number }) => row.id)).toEqual([2101]);
});

test("comercial no recibe permisos ni acceso a movimientos", async ({ page }) => {
  await login(page, "comercial");
  await expect(page.getByText("E2E-COM-2101", { exact: true })).toBeVisible();
  const response = await read(page, "/api/auth/session");
  expect(response.status).toBe(200);
  const session = response.data;
  expect(session.authorization.permissions).toEqual([
    "session.read",
    "reports.commercial.read",
    "reports.export",
  ]);
  expect((await read(page, "/bff/movimientos/buscar")).status).toBe(403);
});

test("cerrar sesión impide volver a consultar movimientos", async ({ page }) => {
  await login(page);
  expect((await read(page, "/api/cliente/rondas?localidadId=1")).status).toBe(200);
  expect((await read(page, "/api/auth/logout", "POST")).status).toBe(200);
  // Stop background readers before the expected 401, which can trigger an auth redirect.
  await page.goto("/login");
  expect((await read(page, "/api/cliente/rondas?localidadId=1")).status).toBe(401);
  await page.goto("/cliente/movimientos");
  await expect(page).toHaveURL(/\/login/);
});
