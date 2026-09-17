import { defineConfig, devices } from "@playwright/test";

const port = 3912;
const apiPort = 3911;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/e2e-api.mjs",
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        API_ORIGIN: `http://127.0.0.1:${apiPort}`,
        API_URL: `http://127.0.0.1:${apiPort}`,
        TORREON_MS_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_PRIVATE_TORREON_MS_URL: `http://127.0.0.1:${apiPort}`,
        TORREON_SERVICE_AUTH_SECRETS: "",
        TORREON_SERVICE_ID: "e2e",
        TORREON_SERVICE_SECRET: "synthetic-e2e-service-secret-only",
        REALTIME_PUBLIC_WS_URL: `ws://127.0.0.1:${apiPort}/realtime/ws`,
        NODE_ENV: "production",
        COSAIF_QUALITY_BUILD: "1",
        SESSION_SECRET: "cosaif-e2e-only-session-secret-0000000000000000",
        TELEMETRY_ENABLED: "false",
      },
    },
  ],
});
