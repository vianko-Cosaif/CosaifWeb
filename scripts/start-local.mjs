import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { constants } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { prepareLocalBuild } from "./prepare-local-build.mjs";

const require = createRequire(import.meta.url);
const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const localTorreonEnvPath = resolve(projectDirectory, "../BackCosaif2/ms_torreon/.env.torreon");

function readLocalTorreonEnv() {
  try {
    const configured = parseEnv(readFileSync(localTorreonEnvPath, "utf8"));
    return Object.fromEntries(
      ["TORREON_SERVICE_AUTH_SECRETS", "TORREON_SERVICE_ID", "TORREON_SERVICE_SECRET"]
        .filter((key) => configured[key])
        .map((key) => [key, configured[key]]),
    );
  } catch {
    return {};
  }
}

/**
 * Starts an existing production build against the local API and Torreón MS without changing .env files.
 * @param {{ spawnProcess?: (command: string, args: string[], options: import("node:child_process").SpawnOptions) => import("node:child_process").ChildProcess, runtime?: NodeJS.Process, readTorreonEnv?: () => Record<string, string> }} [options]
 */
export function startLocal({
  spawnProcess = spawn,
  runtime = process,
  readTorreonEnv = readLocalTorreonEnv,
} = {}) {
  let child;
  let settled = false;
  const forwardInterrupt = () => child.kill("SIGINT");
  const forwardTermination = () => child.kill("SIGTERM");
  const finish = (exitCode) => {
    if (settled) return;
    settled = true;
    runtime.off("SIGINT", forwardInterrupt);
    runtime.off("SIGTERM", forwardTermination);
    runtime.exitCode = exitCode;
  };
  const fail = () => {
    console.error("No se pudo iniciar Next.js. Revisa la instalación y los permisos de ejecución.");
    finish(1);
  };

  try {
    const serviceEnv = { ...runtime.env, ...readTorreonEnv() };
    if (
      !serviceEnv.TORREON_SERVICE_AUTH_SECRETS &&
      !(serviceEnv.TORREON_SERVICE_ID && serviceEnv.TORREON_SERVICE_SECRET)
    ) {
      console.error(
        "Faltan las credenciales locales de servicio de Torreón; revisa ms_torreon/.env.torreon.",
      );
      finish(1);
      return null;
    }
    child = spawnProcess(
      runtime.execPath,
      [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3012"],
      {
        cwd: projectDirectory,
        env: {
          ...serviceEnv,
          NODE_ENV: "production",
          API_ORIGIN: "http://127.0.0.1:3000",
          TORREON_MS_URL: "http://127.0.0.1:3003/api",
        },
        stdio: "inherit",
        shell: false,
      },
    );
  } catch {
    fail();
    return null;
  }

  runtime.on("SIGINT", forwardInterrupt);
  runtime.on("SIGTERM", forwardTermination);
  child.once("error", fail);
  child.once("close", (code, signal) => {
    finish(code ?? (signal ? 128 + (constants.signals[signal] ?? 1) : 1));
  });
  return child;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (prepareLocalBuild(projectDirectory)) startLocal();
  else process.exitCode = 1;
}
