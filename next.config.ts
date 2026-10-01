import type { NextConfig } from "next";
import { FIREBASE_WORKER_CSP } from "./src/lib/firebaseMessagingWorker";
import createBundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: "static",
  openAnalyzer: false,
});

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss: ws:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Hosts adicionales para abrir next dev desde la red local (sin protocolo ni puerto).
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
  // Evita que `next build` reemplace los módulos de un `next dev` activo.
  distDir:
    process.env.COSAIF_QUALITY_BUILD === "1"
      ? ".next-quality"
      : process.env.NODE_ENV === "development"
        ? ".next-dev"
        : ".next",
  // Conserva las secciones visitadas durante una revisión local entre roles.
  onDemandEntries: {
    maxInactiveAge: 10 * 60 * 1000,
    pagesBufferLength: 10,
  },
  outputFileTracingRoot: path.resolve(__dirname),
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          {
            key: "Content-Security-Policy",
            value: FIREBASE_WORKER_CSP,
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
