import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type AuthorizationProfile } from "@/lib/accessControl";
import { loginProfile } from "./fixtures/authorization";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: mocks.session }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/components/Menu/Menu", () => ({ default: () => null }));
vi.mock("@/features/incidentes/operacion/IncidenteController", () => ({
  default: ({ authorization }: { authorization: AuthorizationProfile }) => (
    <span data-role={authorization.role}>Incidentes autorizados</span>
  ),
}));

import Page from "@/app/incidentes/page";

beforeEach(() => mocks.session.mockReset());

describe("general incident route", () => {
  it("rejects an absent or unverifiable session", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(Page()).rejects.toThrow("redirect:/login");
  });

  it("redirects a signed user without incident access to their home", async () => {
    const authorization = loginProfile("COMERCIAL");
    authorization.permissions = authorization.permissions.filter(
      (permission) => permission !== PERMISSIONS.INCIDENTS_READ,
    );
    mocks.session.mockResolvedValue({ authorization });
    await expect(Page()).rejects.toThrow(`redirect:${authorization.capabilities.home}`);
  });

  it("passes the verified profile to the interactive controller", async () => {
    mocks.session.mockResolvedValue({ authorization: loginProfile("SUPERVISOR") });
    expect(renderToStaticMarkup(await Page())).toContain('data-role="SUPERVISOR"');
  });
});
