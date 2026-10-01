import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "--webpack"],
  {
    cwd: resolve(import.meta.dirname, ".."),
    env: { ...process.env, ANALYZE: "true" },
    stdio: "inherit",
    shell: false,
  },
);
child.once("error", () => {
  console.error("No fue posible iniciar el análisis de paquetes.");
  process.exitCode = 1;
});
child.once("close", (code, signal) => {
  if (process.exitCode) return;
  process.exitCode = code ?? (signal ? 1 : 0);
});
