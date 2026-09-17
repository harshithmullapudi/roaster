import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them alongside the app. One fewer build to sequence.
  transpilePackages: ["@roster/ui", "@roster/api", "@roster/auth", "@roster/db"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
