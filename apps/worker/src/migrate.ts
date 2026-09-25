import { migrateToLatest } from "@roster/db/migrate";

async function main(): Promise<void> {
  console.log("[migrate] applying migrations...");
  await migrateToLatest();
  console.log("[migrate] schema is up to date.");
}

main().then(
  () => process.exit(0),
  (cause: unknown) => {
    console.error(
      `[migrate] failed: ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}`,
    );
    process.exit(1);
  },
);
