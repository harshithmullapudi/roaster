import { describe, expect, it } from "vitest";

import "../test/mock-superset";
import { hasDatabase, makeFixture } from "../test/fixtures";

describe.skipIf(!hasDatabase())("who filed a task", () => {
  it("names the member who created it", async () => {
    const fixture = await makeFixture("taskcreator");
    const { createTask, listTasks } = await import("./tasks");

    const created = await createTask({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      title: "who filed this",
      status: "todo",
    });

    expect(created?.createdBy).toEqual({
      memberId: fixture.memberId,
      name: "taskcreator",
    });

    const listed = await listTasks({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      role: "owner",
    });

    expect(listed.find((task) => task.id === created!.id)?.createdBy).toEqual({
      memberId: fixture.memberId,
      name: "taskcreator",
    });

    await fixture.cleanup();
  });

  it("leaves a task readable once its creator is gone", async () => {
    const fixture = await makeFixture("taskcreatorgone");
    const { createTask, findById } = await import("./tasks");
    const { db, members } = await import("@roster/db");
    const { eq } = await import("drizzle-orm");

    const created = await createTask({
      organizationId: fixture.orgId,
      memberId: fixture.memberId,
      title: "outlives its author",
      status: "todo",
    });

    await db.delete(members).where(eq(members.id, fixture.memberId));

    expect((await findById(created!.id))?.createdBy).toBeNull();

    await fixture.cleanup();
  });
});
