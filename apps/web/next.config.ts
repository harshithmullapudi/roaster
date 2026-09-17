import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next build` and `next dev` both write here, and a build that lands while
  // the dev server is running replaces the chunks it has already mapped in
  // memory — the dev server then throws
  // `__webpack_modules__[moduleId] is not a function` on routes it had already
  // compiled, and only recovers per-route as each one rebuilds. The build
  // scripts set NEXT_DIST_DIR so the two never share a directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them alongside the app. One fewer build to sequence.
  transpilePackages: ["@roster/ui", "@roster/api", "@roster/auth", "@roster/db"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
