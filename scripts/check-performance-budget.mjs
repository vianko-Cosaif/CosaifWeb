import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const distDir = process.argv.includes("--quality") ? ".next-quality" : ".next";
const budget = JSON.parse(await readFile(resolve(root, "performance-budget.json"), "utf8"));

async function filesUnder(directory, extension) {
  const found = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith(extension)) found.push(path);
    }
  }
  try {
    await visit(resolve(root, directory));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Falta ${directory}. Ejecuta npm run build antes del presupuesto.`);
    }
    throw error;
  }
  return found;
}

async function check(label, files, limits) {
  if (!files.length) throw new Error(`La compilación no contiene archivos ${label}.`);
  const sizes = await Promise.all(
    files.map(async (file) => ({ file, bytes: (await stat(file)).size })),
  );
  const total = sizes.reduce((sum, item) => sum + item.bytes, 0);
  const largest = sizes.reduce((current, item) => (item.bytes > current.bytes ? item : current));
  const failures = [];
  if (total > limits.maximumTotalBytes)
    failures.push(`total ${total} > ${limits.maximumTotalBytes}`);
  if (largest.bytes > limits.maximumSingleFileBytes) {
    failures.push(`archivo mayor ${largest.bytes} > ${limits.maximumSingleFileBytes}`);
  }
  console.log(
    `${label}: ${total} bytes; mayor ${largest.bytes} bytes (${largest.file.replace(`${root}/`, "")})`,
  );
  if (failures.length) throw new Error(`${label} excede el presupuesto: ${failures.join("; ")}`);
}

await check(
  "JavaScript cliente",
  await filesUnder(`${distDir}/static/chunks`, ".js"),
  budget.clientJavaScript,
);
await check("CSS cliente", await filesUnder(`${distDir}/static/css`, ".css"), budget.clientCss);
