import { expect, test } from "@playwright/test";

test("un evento repetido no reabre la alerta al navegar; un evento nuevo sí avisa", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:3912)/, (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("arrastre");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-COSAIF-2026");
  await page.getByRole("button", { name: /ingresar a la plataforma/i }).click();
  await expect(page).toHaveURL(/\/cliente\/torreon$/);
  const waitForActivity = async () => {
    // Seeing server HTML is insufficient: exercise the hydrated controls before injecting events.
    const button = page.getByRole("button", { name: /^Abrir actividad en tiempo real/ });
    const panel = page.getByRole("complementary", { name: "Actividad reciente" });
    await button.click();
    await expect(panel).toBeVisible();
    await button.click();
    await expect(panel).toHaveCount(0);
  };
  await waitForActivity();
  const event = {
    type: "torreon.movimiento.estado",
    eventId: "browser-replay-one",
    movimientoId: 991,
    empresaId: 3,
    localidadId: 2,
    estado: "EN_PROCESO",
  };
  const emit = (detail: typeof event) =>
    page.evaluate(
      (value) => window.dispatchEvent(new CustomEvent("cosaif:realtime-event", { detail: value })),
      detail,
    );
  await emit(event);
  const toast = page.getByRole("status").filter({ hasText: "Movimiento #991 iniciado" });
  await expect(toast).toBeVisible();
  await toast.click();
  await expect(page.getByRole("complementary", { name: "Actividad reciente" })).toBeVisible();
  await emit(event);
  await emit(event);
  await expect(toast).toHaveCount(0);
  await expect(page.getByText("Movimiento #991 iniciado", { exact: true })).toHaveCount(1);
  await page.goto("/cliente/torreon/movimientos");
  await expect(
    page.getByRole("heading", { name: "Seguimiento de arrastres", exact: true }),
  ).toBeVisible();
  await waitForActivity();
  await emit(event);
  await emit({ ...event, eventId: "browser-replay-two", estado: "CONCLUIDO" });
  await expect(
    page.getByRole("status").filter({ hasText: "Movimiento #991 finalizado" }),
  ).toBeVisible();
  await expect(toast).toHaveCount(0);
});
