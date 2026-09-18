import { describe, expect, it } from "vitest";

import { filterMentions, mentionAttrs, type MentionItem } from "./mentions";

function item(handle: string, slug: string, name: string): MentionItem {
  return {
    id: handle,
    slug,
    name,
    visibility: "public",
    handle,
    display: `${handle.split("-")[0]} [${slug}]`,
  };
}

const agents = [
  item("fern-core", "core", "Core"),
  item("fern-spark-wilderness", "spark-wilderness", "Spark Wilderness"),
  item("ash-web", "web", "Web App"),
];

describe("filterMentions", () => {
  it("offers everything before anything is typed", () => {
    expect(filterMentions(agents, "")).toHaveLength(3);
  });

  it("matches on the agent handle", () => {
    expect(filterMentions(agents, "fern-c")).toEqual([agents[0]]);
  });

  it("matches on the channel slug, so @core finds fern-core", () => {
    expect(filterMentions(agents, "core")).toEqual([agents[0]]);
  });

  it("matches on the channel's display name", () => {
    expect(filterMentions(agents, "web app")).toEqual([agents[2]]);
  });

  it("ignores case and surrounding space", () => {
    expect(filterMentions(agents, "  ASH  ")).toEqual([agents[2]]);
  });

  it("returns nothing for a handle that matches no agent", () => {
    expect(filterMentions(agents, "nobody")).toEqual([]);
  });

  it("caps the list so the popup cannot run off screen", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      item(`fern-c${index}`, `c${index}`, `Channel ${index}`),
    );
    expect(filterMentions(many, "fern")).toHaveLength(8);
  });
});

describe("mentionAttrs", () => {
  const channel: MentionItem = {
    id: "522cf3d5-47bc-48b9-a7cf-406c289e49f6",
    slug: "spark-wilderness",
    name: "Spark Wilderness",
    visibility: "public",
    handle: "fern-spark-wilderness",
    display: "fern [spark-wilderness]",
  };

  it("labels the node with the handle, never the channel id", () => {
    // Both the node's HTML and its plain text render `label ?? id`, so an
    // unset label puts the raw UUID on screen and in the agent's prompt.
    expect(mentionAttrs(channel)).toEqual({
      id: "522cf3d5-47bc-48b9-a7cf-406c289e49f6",
      label: "fern-spark-wilderness",
    });
  });

  it("keeps only the two attributes the node declares", () => {
    expect(Object.keys(mentionAttrs(channel)).sort()).toEqual(["id", "label"]);
  });
});
