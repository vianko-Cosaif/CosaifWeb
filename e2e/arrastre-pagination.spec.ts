import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  for (const theme of ["light", "dark"] as const) {
    test(`Arrastre: paginación, búsqueda y alcance ${viewport.width}px ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((mode) => localStorage.setItem("theme", mode), theme);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
      const requests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/cliente/torreon/arrastres?")) requests.push(request.url());
      });
      await page.goto("/login");
      await page.getByLabel("Usuario").fill("arrastre");
      await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
      await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
      await expect(page).toHaveURL(/\/cliente\/torreon$/);
      await expect(
        page.getByRole("region", { name: "Lectura rápida de la cola visible" }),
      ).toBeVisible();
      const dashboardAxe = await new AxeBuilder({ page }).include("main").analyze();
      expect(
        dashboardAxe.violations.filter((item) =>
          ["critical", "serious"].includes(item.impact ?? ""),
        ),
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`dashboard-${theme}-${viewport.width}.png`),
        fullPage: false,
      });
      await page.goto("/cliente/torreon/movimientos");
      await expect(page.getByText("Mostrando 1-8 de 150 registros")).toBeVisible();
      const ownRow = page.getByRole("article", { name: "Arrastre #1", exact: true });
      await ownRow.locator("summary").click();
      await expect(ownRow.getByRole("button", { name: "Editar movimiento" })).toBeVisible();
      await ownRow.locator("summary").press("Escape");
      await expect(
        page.getByRole("article", { name: "Arrastre #2", exact: true }).locator("summary"),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Ver vagones", exact: true }).first().click();
      await page.screenshot({
        path: testInfo.outputPath(`activos-${theme}-${viewport.width}.png`),
        fullPage: false,
      });
      await page.getByRole("button", { name: "Siguiente", exact: true }).click();
      await expect(page.getByText("Mostrando 9-16 de 150 registros")).toBeVisible();
      await page
        .getByRole("searchbox", { name: "Buscar por folio, vagón, estado o vía" })
        .fill("FXE-150");
      await expect(page.getByText("Mostrando 1-1 de 1 registros")).toBeVisible();
      await expect(
        page.getByText("#150", { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Limpiar filtros" }).click();
      await expect(page.getByText("Mostrando 1-8 de 150 registros")).toBeVisible();
      await page.getByRole("button", { name: /Pasados/ }).click();
      await expect(page.getByText("Mostrando 1-2 de 2 registros")).toBeVisible();
      await expect(
        page.getByText("#151", { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
      await expect(page.getByText("#152", { exact: true })).toHaveCount(0);
      expect(requests.some((value) => new URL(value).searchParams.get("page") === "2")).toBe(true);
      expect(
        requests.every(
          (value) =>
            !new URL(value).searchParams.has("pageSize") ||
            Number(new URL(value).searchParams.get("pageSize")) <= 25,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
      await page
        .getByRole("button", { name: /^(Ver vagones|Ver \d+ vagón(?:es)?)$/ })
        .first()
        .click();
      await expect(
        page.getByRole("button", { name: /^Ocultar (vagones|detalle)$/ }).first(),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
      const results = await new AxeBuilder({ page }).include("main").analyze();
      expect(
        results.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? "")),
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`arrastre-${theme}-${viewport.width}.png`),
        fullPage: false,
      });
    });
  }
}
