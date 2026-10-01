import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const username of ["administrador", "coordinador"]) {
  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"] as const) {
      test(`rondas ${username}: ${width}px ${theme} y pantalla completa`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.addInitScript((mode) => localStorage.setItem("theme", mode), theme);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
        await page.goto("/login");
        await page.getByLabel("Usuario").fill(username);
        await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
        await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
        await expect(page).toHaveURL(new RegExp(`/${username}$`));
        if (username === "administrador")
          await page.getByLabel("Localidad", { exact: true }).selectOption("1");

        const current = page.locator('[data-guide-id="dashboard-current-movement"]');
        const next = page.locator('[data-guide-id="dashboard-rounds-queue"]');
        await expect(current.locator("strong").filter({ hasText: /^1101$/ })).toBeVisible();
        await expect(current.getByText("Empresa de prueba", { exact: true })).toBeVisible();
        await expect(next.getByText("1102", { exact: true })).toBeVisible();
        await expect(next.getByText("Empresa invitada", { exact: true })).toBeVisible();
        await expect(current.getByText("Instrucción privada 1101", { exact: true })).toBeVisible();
        await expect(page.getByText("1103", { exact: true })).toHaveCount(0);
        await expect(page.getByText("2101", { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );

        await page.getByRole("button", { name: "Pantalla completa", exact: true }).click();
        await expect
          .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
          .toBe(true);
        expect(await current.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
        const results = await new AxeBuilder({ page })
          .include('[data-guide-id="dashboard-current-movement"]')
          .include('[data-guide-id="dashboard-rounds-queue"]')
          .analyze();
        expect(
          results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
        ).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`rondas-${username}-${theme}-${width}.png`),
        });
        await page.getByRole("button", { name: "Salir de pantalla completa", exact: true }).click();
        await expect
          .poll(() => page.evaluate(() => document.fullscreenElement === null))
          .toBe(true);
      });
    }
  }
}
