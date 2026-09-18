/**
 * Next calls `register` once, before the server takes its first request — the
 * one moment where a schema change can be applied with nobody mid-flight.
 *
 * Deploys are a `git push` and nothing else, so migrating here is what keeps
 * the database in step with the code that was just built. A database that
 * predates migrations has to be adopted first: see
 * `packages/db/scripts/baseline.mjs`.
 */
export async function register() {
  /** Edge and the browser have no database, and no business opening one. */
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.ROSTER_SKIP_MIGRATIONS === "1") {
    console.log("[db] ROSTER_SKIP_MIGRATIONS=1 — starting without migrating.");
    return;
  }

  const { migrateToLatest } = await import("@roster/db/migrate");

  console.log("[db] applying migrations...");
  await migrateToLatest();
  console.log("[db] schema is up to date.");
}
