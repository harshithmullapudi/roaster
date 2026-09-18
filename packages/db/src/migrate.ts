import { existsSync } from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "./client";

/**
 * Where the generated SQL lives, as seen from wherever the process was
 * started. Next's standalone server chdirs into its own directory, so the repo
 * root can be two levels up rather than the working directory — and the app is
 * run from the root in development. Both are tried rather than guessed at.
 */
function candidates(): string[] {
  const override = process.env.ROSTER_MIGRATIONS_DIR;
  const relative = path.join("packages", "db", "drizzle");

  return [
    ...(override ? [override] : []),
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), "..", "..", relative),
  ];
}

function migrationsFolder(): string | null {
  for (const candidate of candidates()) {
    if (existsSync(path.join(candidate, "meta/_journal.json"))) return candidate;
  }
  return null;
}

/**
 * Bring the database up to the schema this build expects.
 *
 * Drizzle records what it has applied in `drizzle.__drizzle_migrations` and
 * runs the rest inside one transaction, so this is safe to call on every boot
 * and a no-op once the database is current.
 *
 * It deliberately does not swallow failures. A server that answers requests
 * against a schema it was not built for corrupts data quietly; one that
 * refuses to start says so in the deploy log and is restarted.
 */
export async function migrateToLatest(): Promise<void> {
  const folder = migrationsFolder();
  if (!folder) {
    throw new Error(
      `No migrations found. Looked in: ${candidates().join(", ")}. The image ` +
        "must carry packages/db/drizzle, or set ROSTER_MIGRATIONS_DIR.",
    );
  }

  await migrate(db, { migrationsFolder: folder, migrationsSchema: "drizzle" });
}
