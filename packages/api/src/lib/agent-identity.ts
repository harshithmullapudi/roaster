export interface AgentIdentity {
  agentName: string;
  channelSlug: string;
  handle: string;
  display: string;
}

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
