import type { Config } from "drizzle-kit";

import { requireDatabaseUrl } from "./src/env";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: requireDatabaseUrl() },
  casing: "snake_case",
  // better-auth's tables live in their own `auth` schema. drizzle-kit only
  // looks at `public` unless told otherwise, and silently reports "no changes"
  // rather than warning that it ignored every table in the file.
  schemaFilter: ["public", "auth"],
} satisfies Config;
