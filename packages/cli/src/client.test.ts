import { describe, expect, it } from "vitest";

import { readableError } from "./client.js";

describe("an error the server sent", () => {
  it("names the flag a bad uuid came from", () => {
    const zod = JSON.stringify([
      {
        validation: "uuid",
        code: "invalid_string",
        message: "Invalid uuid",
        path: ["channelId"],
      },
    ]);

    expect(readableError(zod)).toBe("--channel-id: Invalid uuid");
  });

  it("names every field that was wrong", () => {
    const zod = JSON.stringify([
      { message: "Invalid uuid", path: ["threadId"] },
      { message: "String must contain at least 1 character(s)", path: ["task"] },
    ]);

    expect(readableError(zod)).toBe(
      "--thread: Invalid uuid; task: String must contain at least 1 character(s)",
    );
  });

  it("falls back to the field name when no flag carries it", () => {
    const zod = JSON.stringify([{ message: "Required", path: ["title"] }]);

    expect(readableError(zod)).toBe("title: Required");
  });

  it("says something useful when the path is empty", () => {
    const zod = JSON.stringify([{ message: "Required", path: [] }]);

    expect(readableError(zod)).toBe("Required");
  });

  it("leaves an ordinary message alone", () => {
    expect(readableError("That task is not one this key can see.")).toBe(
      "That task is not one this key can see.",
    );
  });

  it("leaves JSON that is not a list of issues alone", () => {
    expect(readableError('{"unexpected":true}')).toBe('{"unexpected":true}');
  });

  it("leaves a list that is not issues alone", () => {
    expect(readableError("[1,2,3]")).toBe("[1,2,3]");
  });
});
