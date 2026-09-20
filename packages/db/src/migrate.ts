import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { requireDatabaseUrl } from "./env";
import * as schema from "./schema";

const MIGRATION_LOCK_KEY = 4_314_180_723;

type MigrationDb = ReturnType<typeof migrationClient>["migrationDb"];

function migrationClient() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    max: 2,
    connectionTimeoutMillis: 30_000,
  });

  return {
    pool,
    migrationDb: drizzle({ client: pool, schema, casing: "snake_case" }),
  };
}

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

async function rowExists(
  db: MigrationDb,
  query: ReturnType<typeof sql>,
): Promise<boolean> {
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

const ALREADY_APPLIED: Record<
  string,
  (db: MigrationDb) => Promise<boolean>
> = {
  "0000_baseline": (db) => rowExists(db, TASKS_TABLE),
  "0001_drop_task_descriptions": async (db) =>
    !(await rowExists(db, taskColumn("description"))),
  "0002_task_threads": (db) => rowExists(db, taskColumn("thread_id")),
};

async function adopt(db: MigrationDb, folder: string): Promise<string[]> {
  await db.execute(sql`create schema if not exists drizzle`);
  await db.execute(sql`
    create table if not exists drizzle."__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at bigint
    )`);

  if (
    await rowExists(db, sql`select 1 from drizzle."__drizzle_migrations" limit 1`)
  ) {
    return [];
  }

  const journal = JSON.parse(
    readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const stamped: string[] = [];
  for (const entry of journal.entries) {
    const check = ALREADY_APPLIED[entry.tag];
    if (!check || !(await check(db))) break;

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

export async function migrateToLatest(): Promise<void> {
  const folder = migrationsFolder();
  if (!folder) {
    throw new Error(
      `No migrations found. Looked in: ${candidates().join(", ")}. The image ` +
        "must carry packages/db/drizzle, or set ROSTER_MIGRATIONS_DIR.",
    );
  }

  const { pool, migrationDb } = migrationClient();
  const guard = await pool.connect();

  try {
    await guard.query("set statement_timeout = 0");
    await guard.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

    const adopted = await adopt(migrationDb, folder);
    if (adopted.length > 0) {
      console.log(
        `[db] adopting a database that predates migrations; recorded as already applied: ${adopted.join(", ")}`,
      );
    }

    await migrate(migrationDb, {
      migrationsFolder: folder,
      migrationsSchema: "drizzle",
    });
  } finally {
    try {
      await guard.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    } catch {}
    guard.release();
    await pool.end();
  }
}
