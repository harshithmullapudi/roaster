/**
 * The briefing every session opens with: who this agent is, what the `roster`
 * CLI can do, and — when the work was handed over by another agent — where it
 * came from.
 *
 * Deliberately free of secrets. The CLI authenticates from `~/.roster/config
 * .json` written by `roster login`, precisely so nothing here can leak: this
 * text is echoed into the terminal, and the transcript is scraped into channel
 * messages and progress lines.
 */

export const ENVELOPE_OPEN = "<roster>";
export const ENVELOPE_CLOSE = "</roster>";

export interface DelegationContext {
  /** Handle of the agent that asked, e.g. "ash-spark". */
  askedBy: string;
  /** Channel the request came from — readable for context. */
  originChannelId: string;
}

export interface EnvelopeArgs {
  threadId: string;
  channelId: string;
  /** This agent's own handle, e.g. "fern-core". */
  handle: string;
  delegation?: DelegationContext;
}

export function rosterEnvelope(args: EnvelopeArgs): string {
  const lines = [
    ENVELOPE_OPEN,
    `You are @${args.handle}, the agent for this channel in Roster.`,
    `thread-id: ${args.threadId}`,
    `channel-id: ${args.channelId}`,
    "",
    "The `roster` CLI is available:",
    "  roster channels",
    "  roster read messages --channel-id <id> [--limit N]",
    "  roster tasks create --channel-id <id> <title>",
    `  roster ask <handle> <task> --thread ${args.threadId}`,
    "",
    "`roster ask` hands work to another channel's agent and returns straight",
    "away. After calling it, say what you asked for and end your turn — you",
    "are resumed automatically with their answer. Never poll or wait.",
  ];

  if (args.delegation) {
    lines.push(
      "",
      `This work was handed to you by @${args.delegation.askedBy}.`,
      "For the conversation behind it:",
      `  roster read messages --channel-id ${args.delegation.originChannelId} --limit 20`,
      "Answer in your final message — it is sent back to them verbatim.",
    );
  }

  lines.push(ENVELOPE_CLOSE);
  return lines.join("\n");
}

const ENVELOPE_BLOCK = /<roster>[\s\S]*?<\/roster>\s*/g;

/**
 * Strips the briefing back out of anything scraped from the terminal. The
 * envelope is echoed by the harness, and `agentReply` slices from the last
 * `Assistant:` marker — so without this the agent's own instructions can
 * surface as a channel message or a progress line.
 */
export function stripEnvelope(text: string): string {
  return text.replace(ENVELOPE_BLOCK, "").trim();
}
