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

async function insertSchedule(
  fixture: Fixture,
  args: {
    projectId?: string;
    title: string;
    dueAt: Date;
    rrule?: string;
    runAsMemberId?: string | null;
  },
): Promise<string> {
  const { db, scheduledTasks } = await import("@roster/db");

  const [row] = await db
    .insert(scheduledTasks)
    .values({
      organizationId: fixture.orgId,
      projectId: args.projectId ?? fixture.projectId,
      title: args.title,
      rrule: args.rrule ?? dailyFrom(args.dueAt),
      timezone: "UTC",
      nextRunAt: args.dueAt,
      runAsMemberId:
        args.runAsMemberId === undefined ? fixture.memberId : args.runAsMemberId,
      createdByMemberId: fixture.memberId,
    })
    .returning({ id: scheduledTasks.id });

  return row!.id;
}

async function watching(projectId: string, on: boolean): Promise<void> {
  const { db, projects } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");

  await db
    .update(projects)
    .set({ watchEnabled: on })
    .where(eq(projects.id, projectId));
}

async function messagesIn(projectId: string) {
  const { db, messages } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");

  return db
    .select({
      id: messages.id,
      text: messages.text,
      threadId: messages.threadId,
      clientId: messages.clientId,
    })
    .from(messages)
    .where(eq(messages.projectId, projectId));
}

async function runsFor(scheduleId: string) {
  const { db, scheduledTaskRuns } = await import("@roster/db");
  const { eq } = await import("drizzle-orm");

  return db
    .select()
    .from(scheduledTaskRuns)
    .where(eq(scheduledTaskRuns.scheduledTaskId, scheduleId));
}

async function settle(
  until: () => Promise<boolean> = async () => false,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (await until()) return;
  }
}

function threadsAppear(projectId: string, count: number) {
  return async () => {
    const rows = await messagesIn(projectId);
    return (
      rows.length >= count && rows.every((row) => row.threadId !== null)
    );
  };
}

describe.skipIf(!hasDatabase())("sweeping schedules", () => {
  it("fires into a watching channel and opens a thread", async () => {
    const fixture = await makeFixture("schedwatch");
    await watching(fixture.projectId, true);

    const due = new Date(Date.now() - MINUTE);
    const scheduleId = await insertSchedule(fixture, {
      title: "morning sweep",
      dueAt: due,
    });

    const { sweepSchedules } = await import("./scheduled-tasks");
    await sweepSchedules();
    await settle(threadsAppear(fixture.projectId, 1));

    const posted = await messagesIn(fixture.projectId);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.text).toBe("morning sweep");
    expect(posted[0]!.threadId).not.toBeNull();

    const runs = await runsFor(scheduleId);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.outcome).toBe("fired");
    expect(runs[0]!.taskId).not.toBeNull();

    await fixture.cleanup();
  });

  it("fires into a quiet channel without opening a thread", async () => {
    const fixture = await makeFixture("schedquiet");
    await watching(fixture.projectId, false);

    await insertSchedule(fixture, {
      title: "quiet sweep",
      dueAt: new Date(Date.now() - MINUTE),
    });

    const { sweepSchedules } = await import("./scheduled-tasks");
    await sweepSchedules();
    await settle();

    const posted = await messagesIn(fixture.projectId);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.threadId).toBeNull();

    const { listTasks } = await import("./tasks");
    const tasks = await listTasks({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
    });
    expect(tasks.filter((task) => task.title === "quiet sweep")).toHaveLength(1);

    await fixture.cleanup();
  });

  it("produces nothing when the same slot is swept twice", async () => {
    const fixture = await makeFixture("schedtwice");
    await watching(fixture.projectId, false);

    const due = new Date(Date.now() - MINUTE);
    const scheduleId = await insertSchedule(fixture, {
      title: "once only",
      dueAt: due,
    });

    const { sweepSchedules } = await import("./scheduled-tasks");
    const { db, scheduledTasks } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");

    await sweepSchedules();

    await db
      .update(scheduledTasks)
      .set({ nextRunAt: due })
      .where(eq(scheduledTasks.id, scheduleId));

    await sweepSchedules();
    await settle();

    expect(await messagesIn(fixture.projectId)).toHaveLength(1);
    expect(await runsFor(scheduleId)).toHaveLength(1);

    await fixture.cleanup();
  });

  it("records a stale slot as skipped rather than posting it", async () => {
    const fixture = await makeFixture("schedlate");
    await watching(fixture.projectId, false);

    const { LATE_GRACE_MS } = await import("./scheduled-tasks");
    const stale = new Date(Date.now() - LATE_GRACE_MS - MINUTE);
    const scheduleId = await insertSchedule(fixture, {
      title: "three in the morning",
      dueAt: stale,
    });

    const { sweepSchedules } = await import("./scheduled-tasks");
    await sweepSchedules();
    await settle();

    expect(await messagesIn(fixture.projectId)).toHaveLength(0);

    const runs = await runsFor(scheduleId);
    expect(runs.every((run) => run.outcome === "skipped_late")).toBe(true);

    await fixture.cleanup();
  });

  it("disables a schedule with nobody to run as, and says so in the channel", async () => {
    const fixture = await makeFixture("schednoaccess");
    await watching(fixture.projectId, false);

    const scheduleId = await insertSchedule(fixture, {
      title: "orphaned",
      dueAt: new Date(Date.now() - MINUTE),
      runAsMemberId: null,
    });

    const { sweepSchedules } = await import("./scheduled-tasks");
    await sweepSchedules();
    await settle();

    const runs = await runsFor(scheduleId);
    expect(runs[0]!.outcome).toBe("skipped_no_access");

    const { db, scheduledTasks } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, scheduleId));

    expect(row!.enabled).toBe(false);
    expect(row!.disabledReason).toBeTruthy();

    const posted = await messagesIn(fixture.projectId);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.text).toContain("turned off");

    await fixture.cleanup();
  });

  it("gives two schedules firing together a thread each", async () => {
    const fixture = await makeFixture("schedboth");
    await watching(fixture.projectId, true);

    const due = new Date(Date.now() - MINUTE);
    await insertSchedule(fixture, { title: "first job", dueAt: due });
    await insertSchedule(fixture, { title: "second job", dueAt: due });

    const { sweepSchedules } = await import("./scheduled-tasks");
    await sweepSchedules();
    await settle(threadsAppear(fixture.projectId, 2));

    const posted = await messagesIn(fixture.projectId);
    expect(posted).toHaveLength(2);

    const threads = new Set(posted.map((row) => row.threadId));
    expect(threads.has(null)).toBe(false);
    expect(threads.size).toBe(2);

    await fixture.cleanup();
  });

  it("moves next_run_at forward past the slot it fired", async () => {
    const fixture = await makeFixture("schedadvance");
    await watching(fixture.projectId, false);

    const due = new Date(Date.now() - MINUTE);
    const scheduleId = await insertSchedule(fixture, {
      title: "daily",
      dueAt: due,
    });

    const { sweepSchedules } = await import("./scheduled-tasks");
    await sweepSchedules();

    const { db, scheduledTasks } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, scheduleId));

    expect(row!.nextRunAt!.getTime()).toBeGreaterThan(due.getTime());
    expect(row!.lastRunAt).not.toBeNull();

    await fixture.cleanup();
  });
});

describe.skipIf(!hasDatabase())("managing schedules", () => {
  it("refuses a rule it cannot parse", async () => {
    const fixture = await makeFixture("schedbadrule");
    const { createSchedule } = await import("./scheduled-tasks");

    await expect(
      createSchedule({
        organizationId: fixture.orgId,
        memberId: fixture.memberId,
        role: "owner",
        projectId: fixture.projectId,
        title: "nope",
        rrule: "FREQ=NEVER",
        timezone: "UTC",
      }),
    ).rejects.toThrow();

    await fixture.cleanup();
  });

  it("computes the first run when a schedule is created", async () => {
    const fixture = await makeFixture("schedcreate");
    const { createSchedule } = await import("./scheduled-tasks");

    const schedule = await createSchedule({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      projectId: fixture.projectId,
      title: "every other tuesday",
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
      timezone: "Asia/Kolkata",
    });

    expect(schedule?.nextRunAt).toBeInstanceOf(Date);
    expect(schedule!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(schedule?.createdBy?.name).toBe("schedcreate");
    expect(schedule?.runAs?.name).toBe("schedcreate");

    await fixture.cleanup();
  });

  it("does not let a schedule be read from another organization", async () => {
    const mine = await makeFixture("schedmine");
    const theirs = await makeFixture("schedtheirs");

    const scheduleId = await insertSchedule(theirs, {
      title: "not yours",
      dueAt: new Date(Date.now() + MINUTE),
    });

    const { scheduleById } = await import("./scheduled-tasks");

    expect(
      await scheduleById({
        organizationId: mine.orgId,
        memberId: mine.memberId,
        role: "owner",
        scheduleId,
      }),
    ).toBeNull();

    await theirs.cleanup();
    await mine.cleanup();
  });
});

describe.skipIf(!hasDatabase())("a task message that opens a thread", () => {
  it("links the thread back to its task", async () => {
    const fixture = await makeFixture("schedlink");
    await watching(fixture.projectId, true);

    const { createTask, findById } = await import("./tasks");
    const { assignTask } = await import("./task-assignment");

    const task = await createTask({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      title: "please pick this up",
      status: "todo",
    });

    await assignTask({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      taskId: task!.id,
      projectId: fixture.projectId,
    });

    await settle(async () => (await findById(task!.id))?.threadId !== null);

    const linked = await findById(task!.id);
    expect(linked?.projectId).toBe(fixture.projectId);
    expect(linked?.threadId).not.toBeNull();

    await fixture.cleanup();
  });

  it("leaves the task unstarted in a quiet channel but still assigned", async () => {
    const fixture = await makeFixture("schedquietassign");
    await watching(fixture.projectId, false);

    const { createTask, findById } = await import("./tasks");
    const { assignTask } = await import("./task-assignment");

    const task = await createTask({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      title: "nobody is watching",
      status: "todo",
    });

    await assignTask({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
      taskId: task!.id,
      projectId: fixture.projectId,
    });

    await settle();

    const linked = await findById(task!.id);
    expect(linked?.projectId).toBe(fixture.projectId);
    expect(linked?.threadId).toBeNull();

    await fixture.cleanup();
  });
});
