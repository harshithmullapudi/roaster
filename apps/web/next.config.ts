import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /**
   * A server that carries its own dependencies, for the Docker image. `next
   * start` would need the whole workspace and a pnpm store on the box.
   */
  output: "standalone",
  /**
   * pnpm keeps the real packages at the workspace root and symlinks them into
   * each app, so tracing has to start there or the standalone bundle ships
   * without them. Next runs this config from the app directory.
   */
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
