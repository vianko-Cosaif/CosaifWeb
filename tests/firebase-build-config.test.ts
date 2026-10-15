import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/check-firebase-config.mjs", import.meta.url));
const completeConfig = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "synthetic-api-key-never-log",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "synthetic.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "synthetic-project",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:synthetic",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "synthetic-vapid-key-never-log",
};

function check(env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script], {
    env: { NODE_ENV: "production", VERCEL_ENV: "production", ...env },
    encoding: "utf8",
  });
}

describe("Firebase production build configuration", () => {
  it("blocks a production publication with push enabled but no Firebase configuration", () => {
    const result = check();
    expect(result.status).toBe(1);
    for (const name of Object.keys(completeConfig)) expect(result.stderr).toContain(name);
    expect(result.stderr).toContain("vuelve a compilar");
  });

  it("allows a complete production configuration without optional analytics or storage", () => {
    const result = check(completeConfig);
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toBe("");
  });

  it.each(Object.keys(completeConfig))(
    "rejects a missing %s without exposing other values",
    (name) => {
      const result = check({ ...completeConfig, [name]: "" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(name);
      for (const value of Object.values(completeConfig)) expect(result.stderr).not.toContain(value);
    },
  );

  it.each(["   ", "TU_API_KEY", " TU_VAPID_KEY "])("rejects an unfinished value %j", (value) => {
    const result = check({ ...completeConfig, NEXT_PUBLIC_FIREBASE_VAPID_KEY: value });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_FIREBASE_VAPID_KEY");
    expect(result.stderr).not.toContain(value);
  });

  it.each(["false", "0", "no", " OFF "])("honors intentionally disabled push (%s)", (value) => {
    expect(check({ NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS: value }).status).toBe(0);
  });

  it.each(["", "preview", "development"])("allows local and nonproduction builds (%s)", (value) => {
    expect(check({ VERCEL_ENV: value }).status).toBe(0);
  });
});
