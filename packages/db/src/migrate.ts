import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
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

interface JournalEntry {
  tag: string;
  when: number;
}

async function rowExists(query: ReturnType<typeof sql>): Promise<boolean> {
  const result = await db.execute(query);
  return result.rows.length > 0;
}

const TASKS_TABLE = sql`
  select 1 from information_schema.tables
   where table_schema = 'roster' and table_name = 'tasks'`;

function taskColumn(name: string) {
  return sql`
    select 1 from information_schema.columns
     where table_schema = 'roster' and table_name = 'tasks'
       and column_name = ${name}`;
}

/**
 * How to tell, from the database alone, that a migration's work is already
 * there. Only ever consulted for a database with no journal at all, so each
 * check describes what `drizzle-kit push` would have left behind in the days
 * before migrations existed.
 */
const ALREADY_APPLIED: Record<string, () => Promise<boolean>> = {
  "0000_baseline": () => rowExists(TASKS_TABLE),
  "0001_drop_task_descriptions": async () =>
    !(await rowExists(taskColumn("description"))),
  "0002_task_threads": () => rowExists(taskColumn("thread_id")),
};

/**
 * Adopt a database built before there were migrations.
 *
 * Roster's schema used to be applied with `drizzle-kit push`, so the first
 * deploys left databases holding the tables with no record of how they got
 * them. Migrating one heads straight into `CREATE SCHEMA "auth"` on a schema
 * that already exists, and since the server migrates before it serves, that is
 * a crash loop rather than a bad afternoon.
 *
 * So: when the journal is empty, write the rows for the migrations whose work
 * is already done and let the rest run normally. It writes nothing but
 * drizzle's own table, and cannot engage twice — one row in the journal and
 * this never looks again.
 */
async function adopt(folder: string): Promise<string[]> {
  await db.execute(sql`create schema if not exists drizzle`);
  await db.execute(sql`
    create table if not exists drizzle."__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at bigint
    )`);

  if (await rowExists(sql`select 1 from drizzle."__drizzle_migrations" limit 1`)) {
    return [];
  }

  const journal = JSON.parse(
    readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const stamped: string[] = [];
  for (const entry of journal.entries) {
    const check = ALREADY_APPLIED[entry.tag];
    /**
     * Stop at the first migration whose work is not already there — including
     * one too new to have a check. Everything from here on really does need
     * to run.
     */
    if (!check || !(await check())) break;

    const contents = readFileSync(
      path.join(folder, `${entry.tag}.sql`),
      "utf8",
    );
    const hash = createHash("sha256").update(contents).digest("hex");

    await db.execute(sql`
      insert into drizzle."__drizzle_migrations" ("hash", "created_at")
      values (${hash}, ${entry.when})`);

    stamped.push(entry.tag);
  }

  return stamped;
}

/**
 * Bring the database up to the schema this build expects.
 *
 * Drizzle records what it has applied and runs the rest inside one
 * transaction, so this is safe to call on every boot and a no-op once the
 * database is current.
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

  const adopted = await adopt(folder);
  if (adopted.length > 0) {
    console.log(
      `[db] adopting a database that predates migrations; recorded as already applied: ${adopted.join(", ")}`,
    );
  }

  await migrate(db, { migrationsFolder: folder, migrationsSchema: "drizzle" });
}
