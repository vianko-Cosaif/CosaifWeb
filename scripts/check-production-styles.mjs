import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
const configNames = [
  "postcss.config.cjs",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.json",
  ".postcssrc.json",
  ".postcssrc.js",
];
const configured = await Promise.all(
  configNames.map((name) =>
    access(name).then(
      () => true,
      () => false,
    ),
  ),
);
if (!configured.some(Boolean))
  throw new Error("Missing PostCSS configuration: production build would lose Tailwind styles.");
if (!process.argv.includes("--config-only")) {
  const dist = process.env.COSAIF_QUALITY_BUILD === "1" ? ".next-quality" : ".next";
  const root = path.join(dist, "static");
  const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".css"));
  const css = (
    await Promise.all(files.map((file) => readFile(path.join(root, file), "utf8")))
  ).join("\n");
  const missing = ["flex", "fixed", "items-center", "sr-only", "rounded-xl"].filter(
    (name) => !new RegExp(`\\.${name}\\s*[,{]`).test(css),
  );
  if (missing.length || /@tailwind\s+(?:base|components|utilities)/.test(css))
    throw new Error(
      `Production CSS is incomplete. Missing utilities: ${missing.join(", ") || "unprocessed Tailwind directives"}`,
    );
  console.log(`Production styles verified (${files.length} CSS files).`);
}
