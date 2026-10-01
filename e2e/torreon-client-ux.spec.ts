import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const roles = [
  {
    user: "cliente_torreon",
    heading: "Rondas naturales",
    action: "Editar mis rondas",
    flow: "naturales",
  },
  {
    user: "arrastre",
    heading: "Arrastres de Torreón",
    action: "Solicitar arrastre",
    flow: "arrastres",
  },
] as const;

for (const role of roles) {
  test(`cliente Torreón ${role.flow}: móvil y escritorio en claro y oscuro`, async ({
    page,
  }, testInfo) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
    await page.goto("/login");
    await page.getByLabel("Usuario").fill(role.user);
    await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
    await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
    await expect(page.getByRole("heading", { name: role.heading, exact: true })).toBeVisible();

    for (const width of [390, 1440]) {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.evaluate((mode) => localStorage.setItem("theme", mode), theme);
        await page.reload();

        await expect(page.getByRole("heading", { name: role.heading, exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: role.action })).toBeVisible();
        await expect(page.getByText("Una locomotora por ronda")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        const axe = await new AxeBuilder({ page }).include("main").analyze();
        expect(
          axe.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
        ).toEqual([]);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: testInfo.outputPath(`cliente-${role.flow}-${theme}-${width}.png`),
        });
      }
    }
  });
}
