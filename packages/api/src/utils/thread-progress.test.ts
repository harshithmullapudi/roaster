import { describe, expect, it } from "vitest";

import { agentReply } from "./thread-progress";

const HARNESS = `User: what broke?
Assistant: I looked at the wrong log.
User: and now?
Assistant: The disk filled up.`;

const TUI = `  roster read messages --channel-id 522cf3d5 --limit 20
  Answer in your final message — it is sent back to them verbatim.
  </roster>

  Reply with exactly the word: pong. Do not do anything else.

⏺ pong

✻ Brewed for 2s

  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents
                    ✘ Auto-update failed · Try claude doctor or npm i -g @anthropic-ai/claude-code
                                                                    ● high · /effort`;

const NO_TURN = `  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents
  ✘ Auto-update failed · Try claude doctor
  · Sublimating…`;

describe("reading an agent's reply out of a transcript", () => {
  it("takes the last turn of a harness transcript", () => {
    expect(agentReply(HARNESS)).toBe("The disk filled up.");
  });

  it("takes the last turn of a terminal transcript, without the chrome", () => {
    expect(agentReply(TUI)).toBe("pong");
  });

  it("says nothing rather than handing back the whole screen", () => {
    expect(agentReply(NO_TURN)).toBeNull();
  });
});
