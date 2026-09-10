import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { constants } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectDirectory = fileURLToPath(new URL("../", import.meta.url));

/**
 * Starts an existing production build against the local API, without changing .env files.
 * @param {{ spawnProcess?: (command: string, args: string[], options: import("node:child_process").SpawnOptions) => import("node:child_process").ChildProcess, runtime?: NodeJS.Process }} [options]
 */
export function startLocal({ spawnProcess = spawn, runtime = process } = {}) {
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
    child = spawnProcess(runtime.execPath, [
      require.resolve("next/dist/bin/next"),
      "start", "--hostname", "127.0.0.1", "--port", "3012",
    ], {
      cwd: projectDirectory,
      env: {
        ...runtime.env,
        NODE_ENV: "production",
        API_ORIGIN: "http://127.0.0.1:3001",
      },
      stdio: "inherit",
      shell: false,
    });
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
  startLocal();
}
