import { expect, test } from "@playwright/test";
import budgets from "../performance-budget.json";

const cases = [
  { user: "administrador", path: "/administrador/movimientos", ready: "FXE-1101" },
  { user: "coordinador", path: "/coordinador/movimientos", ready: "FXE-1101" },
  { user: "supervisor", path: "/supervisor/movimientos", ready: "FXE-1101" },
  { user: "cliente", path: "/cliente/movimientos", ready: "FXE-1101" },
  { user: "arrastre", path: "/cliente/torreon/movimientos", ready: "Arrastre #1" },
] as const;

for (const { user, path, ready } of cases) {
  test(`ruta operativa ${user}: datos visibles y presupuesto de carga`, async ({
    page,
  }, testInfo) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
    await page.goto("/login");
    await page.getByLabel("Usuario").fill(user);
    await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
    await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
    await expect(page).toHaveURL(
      user === "arrastre" ? /\/cliente\/torreon$/ : new RegExp(`/${user}$`),
    );

    const started = Date.now();
    await page.goto(path);
    if (user === "arrastre")
      await expect(page.getByRole("article", { name: ready, exact: true })).toBeVisible();
    else await expect(page.getByText(ready, { exact: true }).first()).toBeVisible();
    const dataReadyMs = Date.now() - started;
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const scripts = entries.filter((entry) => new URL(entry.name).pathname.endsWith(".js"));
      const api = entries.filter((entry) =>
        ["/api/", "/bff/", "/xapi/"].some((prefix) =>
          new URL(entry.name).pathname.startsWith(prefix),
        ),
      );
      return {
        scriptBytes: scripts.reduce((total, entry) => total + entry.decodedBodySize, 0),
        scriptRequests: scripts.length,
        apiRequests: api.length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const metrics = { user, path, dataReadyMs, ...resources, backend: "synthetic-local" };
    console.log(`ROLE_ROUTE_METRICS ${JSON.stringify(metrics)}`);
    await testInfo.attach("role-route-performance.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    const budget = budgets.movementRoutes[user];
    expect(resources.horizontalOverflow).toBe(false);
    expect(dataReadyMs).toBeLessThanOrEqual(budget.maximumDataReadyMs);
    expect(resources.scriptBytes).toBeLessThanOrEqual(budget.maximumJavaScriptBytes);
    expect(resources.apiRequests).toBeLessThanOrEqual(budget.maximumApiRequests);
  });
}
