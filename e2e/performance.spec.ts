import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import budgets from "../performance-budget.json";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`carga inicial de login a ${viewport.width}px, ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const metrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const scripts = resources.filter((entry) => new URL(entry.name).pathname.endsWith(".js"));
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        return {
          javaScriptBytes: scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
          javaScriptRequests: scripts.length,
          compressedJavaScriptBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          documentBytes: navigation.decodedBodySize,
          compressedDocumentBytes: navigation.encodedBodySize,
          responseMs: Math.round(navigation.responseStart - navigation.requestStart),
          domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      console.log(`LOGIN_METRICS ${viewport.width} ${JSON.stringify(metrics)}`);
      await testInfo.attach("login-performance.json", {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });
      expect(metrics.javaScriptBytes).toBeGreaterThan(0);
      expect(metrics.javaScriptBytes).toBeLessThanOrEqual(
        budgets.routes.login.maximumJavaScriptBytes,
      );
      expect(metrics.javaScriptRequests).toBeLessThanOrEqual(
        budgets.routes.login.maximumJavaScriptRequests,
      );
      expect(metrics.documentBytes).toBeLessThanOrEqual(budgets.routes.login.maximumDocumentBytes);
      expect(metrics.horizontalOverflow).toBe(false);
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(
        accessibility.violations.filter((issue) =>
          ["critical", "serious"].includes(issue.impact ?? ""),
        ),
      ).toEqual([]);
    });
  }
}
