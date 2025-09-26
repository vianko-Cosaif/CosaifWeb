import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  eslint: { ignoreDuringBuilds: true },
  webpack(c,{dev,isServer}){ if(!dev && !isServer){ c.optimization.minimize=false; c.optimization.minimizer=[]; } return c; }
};
export default nextConfig;
