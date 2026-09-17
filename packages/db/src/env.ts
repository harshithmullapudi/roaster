import { config } from "dotenv";

// Loaded from the repo root so drizzle-kit, the Next server and vitest all
// read the same file.
config({ path: "../../.env", quiet: true });
config({ path: ".env", quiet: true });

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env at the repo root, " +
        "then run `pnpm dev:db` to start Postgres.",
    );
  }
  return url;
}
