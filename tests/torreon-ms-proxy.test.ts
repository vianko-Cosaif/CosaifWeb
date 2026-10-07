import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTorreonMsJson, TorreonMsError } from "@/lib/torreonMs";

const mock = vi.hoisted(() => ({ cookie: vi.fn(), fetch: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mock.cookie }),
}));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("API_ORIGIN", "http://sandbox-backend.invalid/");
  vi.stubEnv("TORREON_SERVICE_AUTH_SECRETS", "");
  vi.stubEnv("TORREON_SERVICE_ID", "");
  vi.stubEnv("TORREON_SERVICE_SECRET", "");
  vi.stubEnv("TORREON_MS_URL", "http://127.0.0.1:3003/api");
  mock.cookie.mockReturnValue({ value: "synthetic-user-token" });
  mock.fetch.mockResolvedValue(Response.json({ vias: [] }));
  vi.stubGlobal("fetch", mock.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Torreón backend proxy", () => {
  it("loads the arrastre catalog with the user session and no service secrets in the web", async () => {
    await expect(fetchTorreonMsJson("/catalogos/arrastre?localidadId=2")).resolves.toEqual({
      vias: [],
    });
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = mock.fetch.mock.calls[0];
    expect(String(url)).toBe(
      "http://sandbox-backend.invalid/torreon/catalogos/arrastre?localidadId=2",
    );
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.headers.get("authorization")).toBe("Bearer synthetic-user-token");
    expect(init.headers.has("x-service-id")).toBe(false);
  });

  it.each([401, 403])(
    "keeps a backend %s denial instead of retrying with service credentials",
    async (status) => {
      mock.fetch.mockResolvedValue(Response.json({ error: "Denied" }, { status }));
      const result = fetchTorreonMsJson("/catalogos/arrastre?localidadId=2");
      await expect(result).rejects.toBeInstanceOf(TorreonMsError);
      await expect(result).rejects.toMatchObject({ status });
      expect(mock.fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("retains signed direct access for calls outside a user request", async () => {
    mock.cookie.mockReturnValue(undefined);
    vi.stubEnv("TORREON_SERVICE_ID", "synthetic-service");
    vi.stubEnv("TORREON_SERVICE_SECRET", "synthetic-service-secret");
    await fetchTorreonMsJson("/catalogos/arrastre?localidadId=2");
    const [url, init] = mock.fetch.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:3003/api/catalogos/arrastre?localidadId=2");
    expect(init.headers.get("x-service-id")).toBe("synthetic-service");
    expect(init.headers.get("x-signature")).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(init.headers.has("authorization")).toBe(false);
  });
});
