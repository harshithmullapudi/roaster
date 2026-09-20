import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "..", ".."),
  transpilePackages: [
    "@roster/ui",
    "@roster/api",
    "@roster/auth",
    "@roster/db",
    "@roster/superset",
  ],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
