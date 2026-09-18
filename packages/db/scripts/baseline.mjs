/**
 * Adopt a database that was built before there were migrations.
 *
 * Roster's schema used to be applied with `drizzle-kit push`, so existing
 * databases carry the tables but no record of how they got them. Running the
 * migrations against one would try to `CREATE SCHEMA "auth"` and fail, and the
 * web service migrates on boot — so an un-adopted database is a crash loop.
 *
 * This writes the journal rows for the migrations whose effects are already
 * there, and nothing else. It touches no table but drizzle's own, is safe to
 * run twice, and does nothing at all to a database that is already migrating
 * or is empty.
 *
 *   DATABASE_URL=... node scripts/baseline.mjs
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";
import pg from "pg";

config({ path: "../../.env", quiet: true });
config({ path: ".env", quiet: true });

const FOLDER = path.join(import.meta.dirname, "..", "drizzle");

/**
 * How to tell, from the database alone, that a migration's work is already
 * done. Only ever consulted for a database that predates the journal, so each
 * check describes the shape `drizzle-kit push` would have left behind.
 */
const ALREADY_APPLIED = {
  "0000_baseline": () =>
    exists(
      `select 1 from information_schema.tables
        where table_schema = 'roster' and table_name = 'tasks'`,
    ),
  "0001_drop_task_descriptions": () => missingColumn("description"),
  "0002_task_threads": () => hasColumn("thread_id"),
};

const { Client } = pg;
const client = new Client({ connectionString: requireUrl() });

function requireUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

async function exists(query) {
  const result = await client.query(query);
  return result.rowCount > 0;
}

function column(name) {
  return `select 1 from information_schema.columns
    where table_schema = 'roster' and table_name = 'tasks'
      and column_name = '${name}'`;
}

async function hasColumn(name) {
  return exists(column(name));
}

async function missingColumn(name) {
  return !(await exists(column(name)));
}

async function main() {
  await client.connect();

  const journal = JSON.parse(
    readFileSync(path.join(FOLDER, "meta", "_journal.json"), "utf8"),
  );

  await client.query(`create schema if not exists drizzle`);
  await client.query(
    `create table if not exists drizzle."__drizzle_migrations" (
       id serial primary key,
       hash text not null,
       created_at bigint
     )`,
  );

  const recorded = await client.query(
    `select count(*)::int as count from drizzle."__drizzle_migrations"`,
  );
  if (recorded.rows[0].count > 0) {
    console.log("Already adopted — the journal has rows. Nothing to do.");
    return;
  }

  const stamped = [];
  for (const entry of journal.entries) {
    const check = ALREADY_APPLIED[entry.tag];
    if (!check) {
      throw new Error(
        `Migration ${entry.tag} has no adoption check. Add one to this script, ` +
          "or migrate the database by hand.",
      );
    }
    if (!(await check())) break;

    const sql = readFileSync(path.join(FOLDER, `${entry.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");

    await client.query(
      `insert into drizzle."__drizzle_migrations" ("hash", "created_at")
       values ($1, $2)`,
      [hash, entry.when],
    );
    stamped.push(entry.tag);
  }

  if (stamped.length === 0) {
    console.log(
      "Nothing already applied — this database is empty. The next boot will " +
        "run every migration.",
    );
    return;
  }

  console.log(`Recorded as already applied:\n  ${stamped.join("\n  ")}`);
  const remaining = journal.entries.length - stamped.length;
  console.log(
    remaining === 0
      ? "The database is up to date."
      : `${remaining} migration(s) will run on the next boot.`,
  );
}

try {
  await main();
} finally {
  await client.end();
}
