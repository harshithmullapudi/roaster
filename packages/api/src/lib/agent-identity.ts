/**
 * An agent is its owner's name paired with the channel it lives in: "fern
 * [core]" on screen, "@fern-core" to type. Every channel has exactly one
 * agent, so the channel identifies it and the owner's name gives it a voice.
 *
 * Both halves may contain hyphens — agent names allow them and `slugifyProject`
 * emits them ("spark-wilderness" is a real slug) — so "fern-spark-wilderness"
 * cannot be split back into its parts. Handles are matched, never parsed.
 */

export interface AgentIdentity {
  agentName: string;
  channelSlug: string;
  /** What you type after `@`. Unique per organization. */
  handle: string;
  /** What the message list shows above a reply. */
  display: string;
}

/** Channels created before onboarding required a name still need a voice. */
const UNNAMED = "agent";

function normalize(agentName: string | null | undefined): string {
  const trimmed = (agentName ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : UNNAMED;
}

export function agentHandle(
  agentName: string | null | undefined,
  channelSlug: string,
): string {
  return `${normalize(agentName)}-${channelSlug}`;
}

export function agentDisplay(
  agentName: string | null | undefined,
  channelSlug: string,
): string {
  return `${normalize(agentName)} [${channelSlug}]`;
}

export function agentIdentity(args: {
  agentName: string | null | undefined;
  channelSlug: string;
}): AgentIdentity {
  const agentName = normalize(args.agentName);
  return {
    agentName,
    channelSlug: args.channelSlug,
    handle: agentHandle(agentName, args.channelSlug),
    display: agentDisplay(agentName, args.channelSlug),
  };
}

export interface HandleCandidate {
  agentName: string | null;
  slug: string;
}

/**
 * Resolve "@fern-spark-wilderness" against channels the caller can see. Both
 * halves are hyphen-bearing, so every candidate is rendered and compared whole
 * rather than the handle being torn at some guessed separator.
 */
export function matchAgentHandle<T extends HandleCandidate>(
  handle: string,
  candidates: T[],
): T | null {
  const wanted = handle.trim().toLowerCase().replace(/^@/, "");
  if (wanted.length === 0) return null;

  for (const candidate of candidates) {
    if (agentHandle(candidate.agentName, candidate.slug) === wanted) {
      return candidate;
    }
  }

  return null;
}
