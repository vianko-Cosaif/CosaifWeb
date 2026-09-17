import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mode = process.argv.includes("--write") ? "--write" : "--check";
const baseRef = process.env.FORMAT_BASE_REF?.trim();
const supported = new Set([
  ".css",
  ".cjs",
  ".graphql",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

// GitHub uses an all-zero SHA for the first push of a branch.
const usableBase = baseRef && !/^0+$/.test(baseRef) ? baseRef : null;
const changed = usableBase
  ? git(["diff", "--name-only", "-z", "--diff-filter=ACMR", `${usableBase}...HEAD`])
  : `${git(["diff", "--name-only", "-z", "--diff-filter=ACMR", "HEAD"])}${git(["ls-files", "-z", "--others", "--exclude-standard"])}`;
const files = [...new Set(changed.split("\0").filter(Boolean))].filter(
  (file) =>
    supported.has(extname(file)) && existsSync(resolve(root, file)) && file !== "package-lock.json",
);

if (!files.length) {
  console.log("Prettier: no hay archivos compatibles nuevos o modificados.");
  process.exit(0);
}

execFileSync(
  process.execPath,
  [resolve(root, "node_modules/prettier/bin/prettier.cjs"), mode, ...files],
  {
    cwd: root,
    stdio: "inherit",
  },
);
