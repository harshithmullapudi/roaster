import { beforeAll, describe, expect, it } from "vitest";

type ReactionsModule = typeof import("./reactions");

let reactionPayload: ReactionsModule["reactionPayload"];
let toReactionRefs: ReactionsModule["toReactionRefs"];

const MESSAGE = "11111111-1111-1111-1111-111111111111";
const THREAD = "22222222-2222-2222-2222-222222222222";
const PROJECT = "33333333-3333-3333-3333-333333333333";
const MEMBER = "44444444-4444-4444-4444-444444444444";

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgres://roster:roster@127.0.0.1:5432/roster";
  ({ reactionPayload, toReactionRefs } = await import("./reactions"));
});

describe("toReactionRefs", () => {
  it("keeps a flat list of refs, ungrouped", () => {
    expect(
      toReactionRefs([
        { emoji: "👍", memberId: MEMBER },
        { emoji: "👍", memberId: THREAD },
      ]),
    ).toEqual([
      { emoji: "👍", memberId: MEMBER },
      { emoji: "👍", memberId: THREAD },
    ]);
  });

  it("parses a json string from the driver", () => {
    expect(toReactionRefs(`[{"emoji":"🎉","memberId":"${MEMBER}"}]`)).toEqual([
      { emoji: "🎉", memberId: MEMBER },
    ]);
  });

  it("falls back to empty for null, undefined and non-arrays", () => {
    expect(toReactionRefs(null)).toEqual([]);
    expect(toReactionRefs(undefined)).toEqual([]);
    expect(toReactionRefs({ emoji: "👍", memberId: MEMBER })).toEqual([]);
  });

  it("falls back to empty for unparseable json", () => {
    expect(toReactionRefs("not json")).toEqual([]);
  });

  it("drops entries that are not shaped like a ref", () => {
    expect(
      toReactionRefs([
        { emoji: "👍", memberId: MEMBER },
        { emoji: 7, memberId: MEMBER },
        { memberId: MEMBER },
        null,
        "👍",
      ]),
    ).toEqual([{ emoji: "👍", memberId: MEMBER }]);
  });

  it("carries only emoji and memberId across", () => {
    expect(
      toReactionRefs([{ emoji: "👍", memberId: MEMBER, id: "row", extra: 1 }]),
    ).toEqual([{ emoji: "👍", memberId: MEMBER }]);
  });
});

describe("reactionPayload", () => {
  it("names the event and carries the thread when there is one", () => {
    expect(
      reactionPayload({
        messageId: MESSAGE,
        projectId: PROJECT,
        threadId: THREAD,
        emoji: "👍",
        memberId: MEMBER,
        added: true,
      }),
    ).toEqual({
      type: "reaction",
      messageId: MESSAGE,
      projectId: PROJECT,
      threadId: THREAD,
      emoji: "👍",
      memberId: MEMBER,
      added: true,
    });
  });

  it("keeps a null thread null and reports a removal", () => {
    const payload = reactionPayload({
      messageId: MESSAGE,
      projectId: PROJECT,
      threadId: null,
      emoji: "👍",
      memberId: MEMBER,
      added: false,
    });

    expect(payload.threadId).toBeNull();
    expect(payload.added).toBe(false);
  });
});
