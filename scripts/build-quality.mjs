import { spawnSync } from "node:child_process";

// Keep checks independent from the build served on port 3012.
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      COSAIF_QUALITY_BUILD: "1",
      NEXT_PUBLIC_API_BASE: "/bff",
      NEXT_PUBLIC_API_URL: "/bff",
      NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS: "false",
      NEXT_PUBLIC_TORREON_LOCALIDAD_IDS: "2",
    },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
