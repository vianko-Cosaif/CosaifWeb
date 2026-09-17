import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`Torreón: navegación y diseño ${width}px ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.addInitScript((mode) => localStorage.setItem("theme", mode), theme);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
      await page.goto("/login");
      await page.getByLabel("Usuario").fill("coordinador_torreon");
      await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
      await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
      await expect(page.getByRole("heading", { name: "Operación del patio" })).toBeVisible();
      await page.getByRole("button", { name: "Ver cola de arrastres" }).click();
      await expect(
        page.getByRole("region", { name: "Lectura rápida de la cola visible" }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`torreon-arrastres-${theme}-${width}.png`),
      });
      await page
        .getByRole("group", { name: "Tipo de operación en Torreón" })
        .getByRole("button", { name: /Rondas naturales/ })
        .click();
      await expect(page.getByRole("heading", { name: "Locomotora en movimiento" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "4800", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const axe = await new AxeBuilder({ page }).include("main").analyze();
      expect(
        axe.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`torreon-naturales-${theme}-${width}.png`),
      });
      await page.goto("/coordinador/movimientos");
      await page
        .getByRole("group", { name: "Tipo de operación en Torreón" })
        .getByRole("button", { name: "Arrastres", exact: true })
        .click();
      const firstRequest = page.getByRole("article", { name: "Arrastre #1", exact: true });
      await expect(
        firstRequest.getByRole("button", { name: "Iniciar", exact: true }),
      ).toBeVisible();
      await firstRequest.getByRole("button", { name: "Ver vagones" }).click();
      expect(
        await page
          .getByRole("article", { name: /^Arrastre #/ })
          .evaluateAll((rows) => rows.every((row) => row.scrollWidth <= row.clientWidth + 1)),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`torreon-operacion-${theme}-${width}.png`),
      });
    });
  }
}
