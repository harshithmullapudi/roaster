import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireDatabaseUrl } from "./env";
import * as schema from "./schema";

/**
 * Roster runs as a long-lived container on Railway, so a plain node-postgres
 * pool is the right driver — superset's Neon serverless setup exists to
 * survive Vercel's per-request isolation, which does not apply here.
 *
 * The pool is cached on globalThis because Next's dev server re-evaluates
 * modules on every hot reload, and a fresh pool each time exhausts Postgres'
 * connection limit within a few edits.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ?? new Pool({ connectionString: requireDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle({ client: pool, schema, casing: "snake_case" });

export type Db = typeof db;
