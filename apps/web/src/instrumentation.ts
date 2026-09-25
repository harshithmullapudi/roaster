export async function register() {
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
