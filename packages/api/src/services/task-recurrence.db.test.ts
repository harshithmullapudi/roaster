import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture, type Fixture } from "../test/fixtures";

const MINUTE = 60_000;

function floating(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

function dailyFrom(at: Date): string {
  return `DTSTART:${floating(at)}\nRRULE:FREQ=DAILY`;
}

async function repeatingTask(
  fixture: Fixture,
  args: { title: string; dueAt: Date; projectId?: string | null },
): Promise<string> {
  const { db, tasks } = await import("@roster/db");

  const [row] = await db
    .insert(tasks)
    .values({
      organizationId: fixture.orgId,
      projectId:
        args.projectId === undefined ? fixture.projectId : args.projectId,
      title: args.title,
      status: "todo",
      rrule: dailyFrom(args.dueAt),
      timezone: "UTC",
      nextRunAt: args.dueAt,
      createdByMemberId: fixture.memberId,
    })
    .returning({ id: tasks.id });

  return row!.id;
}

async function watching(projectId: string, on: boolean): Promise<void> {
  const { db, projects } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  await db.update(projects).set({ watchEnabled: on }).where(eq(projects.id, projectId));
}

async function messagesIn(projectId: string) {
  const { db, messages } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  return db
    .select({ text: messages.text, threadId: messages.threadId, clientId: messages.clientId })
    .from(messages)
    .where(eq(messages.projectId, projectId));
}

async function runsFor(taskId: string) {
  const { db, taskRuns } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  return db.select().from(taskRuns).where(eq(taskRuns.taskId, taskId));
}

async function dueAgain(taskId: string, at: Date): Promise<void> {
  const { db, tasks } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");
  await db.update(tasks).set({ nextRunAt: at }).where(eq(tasks.id, taskId));
}

async function settle(until: () => Promise<boolean> = async () => false) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (await until()) return;
  }
}

describe.skipIf(!hasDatabase())("a task that repeats", () => {
  it("posts and opens a thread in a watching channel", async () => {
    const fixture = await makeFixture("recurwatch");
    await watching(fixture.projectId, true);

    const taskId = await repeatingTask(fixture, {
      title: "PR review check",
      dueAt: new Date(Date.now() - MINUTE),
    });

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();
    await settle(async () => (await messagesIn(fixture.projectId)).some((m) => m.threadId));

    const posted = await messagesIn(fixture.projectId);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.threadId).not.toBeNull();
    expect((await runsFor(taskId))[0]!.outcome).toBe("fired");

    await fixture.cleanup();
  });

  it("posts a second time on the next occurrence", async () => {
    const fixture = await makeFixture("recurtwice");
    await watching(fixture.projectId, false);

    const first = new Date(Date.now() - MINUTE);
    const taskId = await repeatingTask(fixture, {
      title: "PR review check",
      dueAt: first,
    });

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();
    await settle();

    await dueAgain(taskId, new Date(Date.now() - MINUTE / 2));
    await sweepTasks();
    await settle();

    const posted = await messagesIn(fixture.projectId);
    expect(posted).toHaveLength(2);
    expect(new Set(posted.map((m) => m.clientId)).size).toBe(2);
    expect(await runsFor(taskId)).toHaveLength(2);

    await fixture.cleanup();
  }, 20_000);

  it("reopens the same task rather than making a new one", async () => {
    const fixture = await makeFixture("recurreopen");
    await watching(fixture.projectId, false);

    const taskId = await repeatingTask(fixture, {
      title: "PR review check",
      dueAt: new Date(Date.now() - MINUTE),
    });

    const { db, tasks } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");

    await db
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(tasks.id, taskId));

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();
    await settle();

    const all = await db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, fixture.orgId));

    expect(all).toHaveLength(1);
    expect(all[0]!.status).toBe("todo");
    expect(all[0]!.completedAt).toBeNull();

    await fixture.cleanup();
  });

  it("records a stale slot as skipped rather than posting it", async () => {
    const fixture = await makeFixture("recurlate");
    await watching(fixture.projectId, false);

    const { LATE_GRACE_MS } = await import("./task-recurrence");
    const taskId = await repeatingTask(fixture, {
      title: "three in the morning",
      dueAt: new Date(Date.now() - LATE_GRACE_MS - MINUTE),
    });

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();
    await settle();

    expect(await messagesIn(fixture.projectId)).toHaveLength(0);
    expect((await runsFor(taskId)).every((r) => r.outcome === "skipped_late")).toBe(true);

    await fixture.cleanup();
  });

  it("produces nothing when the same slot is swept twice", async () => {
    const fixture = await makeFixture("recursameslot");
    await watching(fixture.projectId, false);

    const due = new Date(Date.now() - MINUTE);
    const taskId = await repeatingTask(fixture, { title: "once only", dueAt: due });

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();
    await dueAgain(taskId, due);
    await sweepTasks();
    await settle();

    expect(await messagesIn(fixture.projectId)).toHaveLength(1);
    expect(await runsFor(taskId)).toHaveLength(1);

    await fixture.cleanup();
  }, 20_000);

  it("stops repeating when there is no channel to post into", async () => {
    const fixture = await makeFixture("recurnochannel");

    const taskId = await repeatingTask(fixture, {
      title: "orphaned",
      dueAt: new Date(Date.now() - MINUTE),
      projectId: null,
    });

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();
    await settle();

    expect((await runsFor(taskId))[0]!.outcome).toBe("skipped_no_access");

    const { db, tasks } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

    expect(row!.rrule).toBeNull();
    expect(row!.nextRunAt).toBeNull();
    expect(row!.recurrenceDisabledReason).toBeTruthy();

    await fixture.cleanup();
  });

  it("moves next_run_at forward past the slot it fired", async () => {
    const fixture = await makeFixture("recuradvance");
    await watching(fixture.projectId, false);

    const due = new Date(Date.now() - MINUTE);
    const taskId = await repeatingTask(fixture, { title: "daily", dueAt: due });

    const { sweepTasks } = await import("./task-recurrence");
    await sweepTasks();

    const { db, tasks } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));

    expect(row!.nextRunAt!.getTime()).toBeGreaterThan(due.getTime());

    await fixture.cleanup();
  });
});
