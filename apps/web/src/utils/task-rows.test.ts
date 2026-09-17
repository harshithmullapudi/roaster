import type { Task, TaskStatus } from "@roster/api";
import { describe, expect, it } from "vitest";

import { buildRows, filterTasks, type TaskRow } from "./task-rows";

function task(
  id: string,
  status: TaskStatus,
  channelSlug: string,
): Task {
  return {
    id,
    projectId: `project-${channelSlug}`,
    title: `Task ${id}`,
    description: null,
    descriptionText: "",
    status,
    createdAt: new Date("2026-09-17T10:00:00Z"),
    completedAt: null,
    channelSlug,
    channelName: channelSlug,
  };
}

function labels(rows: TaskRow[]): string[] {
  return rows.map((row) =>
    row.type === "header" ? `# ${row.label} (${row.count})` : row.task.id,
  );
}

describe("buildRows grouped by status", () => {
  it("orders groups open-work-first and done last", () => {
    const rows = buildRows(
      [
        task("a", "done", "web"),
        task("b", "todo", "web"),
        task("c", "in_progress", "web"),
      ],
      "status",
    );

    expect(labels(rows)).toEqual([
      "# in_progress (1)",
      "c",
      "# todo (1)",
      "b",
      "# done (1)",
      "a",
    ]);
  });

  it("drops groups with no tasks rather than showing an empty heading", () => {
    const rows = buildRows([task("a", "todo", "web")], "status");

    expect(labels(rows)).toEqual(["# todo (1)", "a"]);
  });

  it("keeps the incoming order within a group", () => {
    const rows = buildRows(
      [task("first", "todo", "web"), task("second", "todo", "web")],
      "status",
    );

    expect(labels(rows)).toEqual(["# todo (2)", "first", "second"]);
  });
});

describe("buildRows grouped by channel", () => {
  it("sorts channels alphabetically and counts each", () => {
    const rows = buildRows(
      [
        task("a", "todo", "web"),
        task("b", "done", "core"),
        task("c", "todo", "web"),
      ],
      "channel",
    );

    expect(labels(rows)).toEqual([
      "# core (1)",
      "b",
      "# web (2)",
      "a",
      "c",
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(buildRows([], "channel")).toEqual([]);
    expect(buildRows([], "status")).toEqual([]);
  });
});

describe("filterTasks", () => {
  const tasks = [
    task("a", "todo", "web"),
    task("b", "done", "core"),
    task("c", "in_progress", "web"),
  ];

  it("treats an empty facet as no filter", () => {
    expect(filterTasks(tasks, { statuses: [], channels: [] })).toHaveLength(3);
  });

  it("filters by status", () => {
    const result = filterTasks(tasks, { statuses: ["todo"], channels: [] });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("filters by channel", () => {
    const result = filterTasks(tasks, { statuses: [], channels: ["web"] });
    expect(result.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("intersects the two facets", () => {
    const result = filterTasks(tasks, {
      statuses: ["done"],
      channels: ["web"],
    });
    expect(result).toEqual([]);
  });
});
