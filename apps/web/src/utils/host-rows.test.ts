import type { HostProjects } from "@roster/api";
import { describe, expect, it } from "vitest";

import { hostRows, selectedProjects } from "./host-rows";

const host = (over: Partial<HostProjects["host"]> = {}) => ({
  id: "host-1",
  name: "studio",
  online: true,
  wakeCommand: null,
  organizationId: "org-1",
  platform: "darwin",
  ...over,
});

const project = (over: Partial<HostProjects["projects"][number]> = {}) => ({
  id: "p1",
  name: "Spark",
  repoPath: "/code/spark",
  repoOwner: "tegon",
  repoName: "spark",
  repoUrl: "https://github.com/tegon/spark",
  added: false,
  ...over,
});

describe("hostRows", () => {
  it("calls an offline host asleep and keeps its wake command", () => {
    const rows = hostRows([
      {
        host: host({ online: false, wakeCommand: "superset hosts wake studio" }),
        projects: [],
        error: null,
      },
    ]);

    expect(rows[0]).toMatchObject({
      status: "asleep",
      wakeCommand: "superset hosts wake studio",
    });
  });

  it("calls an online host that did not answer unreachable", () => {
    const rows = hostRows([
      { host: host(), projects: [], error: "That machine did not answer." },
    ]);

    expect(rows[0]).toMatchObject({
      status: "unreachable",
      error: "That machine did not answer.",
    });
  });

  it("puts the projects that are not channels yet first", () => {
    const rows = hostRows([
      {
        host: host(),
        projects: [
          project({ id: "p1", name: "Spark", added: true }),
          project({ id: "p2", name: "Wilderness", added: false }),
        ],
        error: null,
      },
    ]);

    expect(rows[0]!.projects.map((row) => row.id)).toEqual(["p2", "p1"]);
  });

  it("formats the repository, and leaves it out when there isn't one", () => {
    const rows = hostRows([
      {
        host: host(),
        projects: [
          project({ id: "p1" }),
          project({ id: "p2", repoOwner: null, repoName: null }),
        ],
        error: null,
      },
    ]);

    expect(rows[0]!.projects.map((row) => row.repo)).toEqual([
      "tegon/spark",
      null,
    ]);
  });
});

describe("selectedProjects", () => {
  const hosts: HostProjects[] = [
    {
      host: host({ id: "host-1" }),
      projects: [project({ id: "p1" }), project({ id: "p2", added: true })],
      error: null,
    },
    {
      host: host({ id: "host-2", name: "laptop" }),
      projects: [project({ id: "p3", name: "Roster" })],
      error: null,
    },
  ];

  it("builds the payload from every host, not just the first", () => {
    const chosen = selectedProjects(hosts, new Set(["p1", "p3"]));

    expect(chosen).toEqual([
      {
        supersetProjectId: "p1",
        supersetHostId: "host-1",
        name: "Spark",
        repoOwner: "tegon",
        repoName: "spark",
        repoUrl: "https://github.com/tegon/spark",
        repoPath: "/code/spark",
      },
      {
        supersetProjectId: "p3",
        supersetHostId: "host-2",
        name: "Roster",
        repoOwner: "tegon",
        repoName: "spark",
        repoUrl: "https://github.com/tegon/spark",
        repoPath: "/code/spark",
      },
    ]);
  });

  it("refuses a project that is already a channel", () => {
    expect(selectedProjects(hosts, new Set(["p2"]))).toEqual([]);
  });

  it("returns nothing when nothing is ticked", () => {
    expect(selectedProjects(hosts, new Set())).toEqual([]);
  });
});
