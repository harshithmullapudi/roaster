import type { Config } from "drizzle-kit";

import { requireDatabaseUrl } from "./src/env";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: requireDatabaseUrl() },
  casing: "snake_case",
  schemaFilter: ["public", "auth", "roster"],
} satisfies Config;
