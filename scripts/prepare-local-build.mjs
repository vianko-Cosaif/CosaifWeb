import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

function newestChange(path) {
  let stats;
  try {
    stats = statSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
  if (!stats.isDirectory()) return stats.mtimeMs;
  return readdirSync(path, { withFileTypes: true }).reduce(
    (latest, entry) => entry.isSymbolicLink() ? latest : Math.max(latest, newestChange(resolve(path, entry.name))),
    stats.mtimeMs,
  );
}

export function needsLocalBuild(directory) {
  const builtAt = newestChange(resolve(directory, ".next/BUILD_ID"));
  if (!builtAt) return true;
  return [
    "src", "public", "next.config.ts", "tsconfig.json", "package.json", "package-lock.json",
    ".env", ".env.local", ".env.production", ".env.production.local",
  ].some((input) => newestChange(resolve(directory, input)) > builtAt);
}

/** Never serve an older editor after source changes in a local production session. */
export function prepareLocalBuild(directory, build = spawnSync) {
  if (!needsLocalBuild(directory)) return true;
  console.log("La compilación local está desactualizada. Compilando los cambios antes de iniciar…");
  const result = build(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], {
    cwd: directory,
    env: { ...process.env, NODE_ENV: "production", COSAIF_QUALITY_BUILD: "0" },
    stdio: "inherit",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    console.error("No se inició la web: la compilación falló. Corrige el error e intenta de nuevo.");
    return false;
  }
  return true;
}
