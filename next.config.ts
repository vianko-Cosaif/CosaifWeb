// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const devOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // 👇 hace visible API_URL en el cliente como NEXT_PUBLIC_API_URL
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL,
  },

  // allowedDevOrigins is not a valid Next.js experimental config, so it has been removed

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
};

export default nextConfig;
