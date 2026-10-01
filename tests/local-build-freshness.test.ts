import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { needsLocalBuild, prepareLocalBuild } from "../scripts/prepare-local-build.mjs";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "cosaif-build-"));
  directories.push(directory);
  mkdirSync(join(directory, "src"));
  mkdirSync(join(directory, ".next"));
  writeFileSync(join(directory, "src/page.tsx"), "export default function Page() {}");
  writeFileSync(join(directory, ".next/BUILD_ID"), "old-build");
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(directory, "src/page.tsx"), past, past);
  utimesSync(join(directory, "src"), past, past);
  return directory;
}

describe("local build freshness", () => {
  it("reuses a current build without recompiling", () => {
    const directory = fixture();
    const build = vi.fn();
    expect(prepareLocalBuild(directory, build)).toBe(true);
    expect(build).not.toHaveBeenCalled();
  });
  it.each(["src/page.tsx", "next.config.ts", ".env.local"])("rebuilds after %s changes", (input) => {
    const directory = fixture();
    writeFileSync(join(directory, input), "changed");
    const future = new Date(Date.now() + 1000);
    utimesSync(join(directory, input), future, future);
    expect(needsLocalBuild(directory)).toBe(true);
    const build = vi.fn().mockReturnValue({ status: 0 });
    expect(prepareLocalBuild(directory, build)).toBe(true);
    expect(build).toHaveBeenCalledOnce();
  });
  it("requires a build when BUILD_ID is missing", () => {
    const directory = fixture();
    rmSync(join(directory, ".next/BUILD_ID"));
    expect(needsLocalBuild(directory)).toBe(true);
  });
  it("does not fall back to an old build if compilation fails", () => {
    const directory = fixture();
    rmSync(join(directory, "src/page.tsx"));
    const future = new Date(Date.now() + 1000);
    utimesSync(join(directory, "src"), future, future);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(prepareLocalBuild(directory, vi.fn().mockReturnValue({ status: 1 }))).toBe(false);
  });
});
