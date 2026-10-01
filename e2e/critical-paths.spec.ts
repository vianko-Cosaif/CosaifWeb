import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const users = [
  ["administrador", /\/administrador/],
  ["comercial", /\/comercial\/reporte-general$/],
  ["coordinador", /\/coordinador/],
  ["supervisor", /\/supervisor/],
  ["cliente", /\/cliente/],
] as const;

test("el acceso público no tiene fallos automáticos críticos de accesibilidad", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
  ).toEqual([]);
});

for (const [username, destination] of users) {
  test(`inicia sesión y monta el área principal de ${username}`, async ({ page }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
    await page.goto("/login");
    await page.getByLabel("Usuario").fill(username);
    await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
    await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
    await expect(page).toHaveURL(destination, { timeout: 15_000 });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("navigation").first()).toBeVisible();
    await expect(page.getByText(/application error/i)).toHaveCount(0);
  });
}

test("un cliente no puede navegar al área administrativa", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("cliente");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(/\/cliente/);
  await page.goto("/administrador");
  await expect(page).toHaveURL(/\/cliente/);
});

test("credenciales inválidas muestran el error y permiten reintentar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("cliente");
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta-sintetica");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Usuario o contraseña incorrectos" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(/\/cliente$/);
});
