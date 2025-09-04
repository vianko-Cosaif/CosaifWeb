// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const devOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Solo define experimental si hay orígenes
  ...(devOrigins.length ? { experimental: { allowedDevOrigins: devOrigins } } : {}),

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },

  // ⛔️ Sin rewrites: /xapi/* lo maneja src/app/xapi/[...path]/route.ts
  // async rewrites() { return []; },
};

export default nextConfig;
