import { describe, expect, it } from "vitest";

import { rosterEnvelope, stripEnvelope } from "./roster-envelope";

const base = {
  threadId: "8f3a0000-0000-0000-0000-000000000001",
  channelId: "1c7d0000-0000-0000-0000-000000000002",
  handle: "fern-core",
};

describe("rosterEnvelope", () => {
  it("tells the agent who it is and which thread it is in", () => {
    const envelope = rosterEnvelope(base);
    expect(envelope).toContain("@fern-core");
    expect(envelope).toContain(`thread-id: ${base.threadId}`);
    expect(envelope).toContain(`channel-id: ${base.channelId}`);
  });

  it("tells it to end its turn rather than wait, which is what parks it", () => {
    expect(rosterEnvelope(base)).toContain("Never poll or wait.");
  });

  it("names the asker and the channel to read when work was handed over", () => {
    const envelope = rosterEnvelope({
      ...base,
      delegation: { askedBy: "ash-spark", originChannelId: "origin-id" },
    });
    expect(envelope).toContain("handed to you by @ash-spark");
    expect(envelope).toContain("--channel-id origin-id --limit 20");
  });

  it("offers a thread read, so an agent can follow a thread it finds", () => {
    expect(rosterEnvelope(base)).toContain(
      "roster read messages --thread-id <id>",
    );
  });

  it("says where a thread id comes from, since the agent only knows its own", () => {
    expect(rosterEnvelope(base)).toContain(
      "A channel read marks every message that has a thread",
    );
  });

  it("says nothing about a handover when there wasn't one", () => {
    expect(rosterEnvelope(base)).not.toContain("handed to you");
  });

  it("carries the task, so the agent can move its status itself", () => {
    const envelope = rosterEnvelope({
      ...base,
      task: { id: "task-id", title: "Ship the importer", status: "todo" },
    });

    expect(envelope).toContain("working on this task: Ship the importer");
    expect(envelope).toContain("task-id: task-id");
    expect(envelope).toContain("roster tasks status task-id in_progress");
  });

  it("says nothing about a task when the thread was not opened by one", () => {
    expect(rosterEnvelope(base)).not.toContain("task-id:");
  });

  it("tells the agent when to leave a new task unassigned", () => {
    expect(rosterEnvelope(base)).toContain(
      "Pass --channel-id only when someone named the channel",
    );
  });

  it("carries no credential", () => {
    const envelope = rosterEnvelope({
      ...base,
      delegation: { askedBy: "ash-spark", originChannelId: "origin-id" },
    });
    expect(envelope).not.toMatch(/rst_|token|secret|api[-_ ]?key/i);
  });
});

describe("stripEnvelope", () => {
  it("removes the briefing from a scraped transcript", () => {
    const scraped = `${rosterEnvelope(base)}\nBuild is green.`;
    expect(stripEnvelope(scraped)).toBe("Build is green.");
  });

  it("removes every briefing when a session was resumed", () => {
    const scraped = [
      rosterEnvelope(base),
      "First answer.",
      rosterEnvelope(base),
      "Second answer.",
    ].join("\n");
    expect(stripEnvelope(scraped)).toBe("First answer.\nSecond answer.");
  });

  it("leaves ordinary replies untouched", () => {
    expect(stripEnvelope("  Build is green.  ")).toBe("Build is green.");
  });

  it("does not eat text that merely mentions roster", () => {
    expect(stripEnvelope("I ran roster ask and it worked")).toBe(
      "I ran roster ask and it worked",
    );
  });
});
