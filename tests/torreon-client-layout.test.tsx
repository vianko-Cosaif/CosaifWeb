import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: mocks.session }));
vi.mock("@/components/layout/AdaptiveAppShell", () => ({
  default: ({
    hideBanner,
    beforeMain,
    children,
  }: {
    hideBanner: boolean;
    beforeMain: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-hide-banner={String(hideBanner)}>
      {beforeMain}
      <main>{children}</main>
    </div>
  ),
}));
vi.mock("@/features/incidentes/monitor/ScopedIncidentMonitor", () => ({
  default: ({ scope }: { scope: string }) => <span data-incident-scope={scope} />,
}));

import ClienteLayout from "@/app/cliente/layout";

beforeEach(() => {
  mocks.session.mockReset();
  vi.stubEnv("NEXT_PUBLIC_TORREON_LOCALIDAD_IDS", "2");
  vi.stubEnv("NEXT_PUBLIC_TORREON_LOCALIDAD_ID", "2");
});
afterEach(() => vi.unstubAllEnvs());

describe("client layout banner by verified locality", () => {
  it.each([
    { name: "Torreón", session: { localidadId: 2 }, hideBanner: true },
    { name: "Guadalajara", session: { localidadId: 1 }, hideBanner: false },
    { name: "an absent session", session: null, hideBanner: false },
  ])("preserves the requested banner behavior for $name", async ({ session, hideBanner }) => {
    mocks.session.mockResolvedValue(session);
    const markup = renderToStaticMarkup(
      await ClienteLayout({ children: <span>Contenido del cliente</span> }),
    );

    expect(markup).toContain(`data-hide-banner="${hideBanner}"`);
    expect(markup).toContain("Contenido del cliente");
    expect(markup).toContain('data-incident-scope="cliente"');
    expect(mocks.session).toHaveBeenCalledOnce();
  });
});
