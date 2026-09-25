/*
 * An agent's handle is stored on its member row rather than computed from a
 * person's name and a channel slug, because a channel can hold several agents
 * and only one of them could ever have carried the computed name.
 */
export function normalizeHandle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^@/, "");
}

const UNNAMED = "agent";

export function agentDisplay(handle: string | null | undefined): string {
  const normalized = normalizeHandle(handle);
  return normalized.length > 0 ? normalized : UNNAMED;
}

/*
 * The handle a channel's first agent is given: the adder's own agent name
 * joined to the channel slug. Kept so a channel added today is named the same
 * way as every channel the backfill renamed.
 */
export function channelAgentHandle(
  ownerAgentName: string | null | undefined,
  channelSlug: string,
): string {
  const owner = normalizeHandle(ownerAgentName);
  return `${owner.length > 0 ? owner : UNNAMED}-${channelSlug}`;
}
