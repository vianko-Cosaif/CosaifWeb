import "server-only";
import path from "path";

export function getTorreonUploadsRoots(
  cwd = process.cwd(),
  configuredRoot = process.env.TORREON_UPLOADS_DIR,
) {
  const candidates = [
    configuredRoot,
    path.resolve(cwd, "../BackCosaif/uploads/incidentes"),
    path.resolve(cwd, "../BackCosaif/ms_torreon/uploads/incidentes"),
    path.resolve(cwd, "../BackCosaif2/uploads/incidentes"),
    path.resolve(cwd, "../BackCosaif2/ms_torreon/uploads/incidentes"),
  ].filter((item): item is string => Boolean(item?.trim()));

  const seen = new Set<string>();
  return candidates
    .map((item) => path.resolve(cwd, item))
    .filter((item) => {
      const key = process.platform === "win32" ? item.toLowerCase() : item;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
