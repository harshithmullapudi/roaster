export function normalizeHandle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^@/, "");
}

const UNNAMED = "agent";

export function agentDisplay(handle: string | null | undefined): string {
  const normalized = normalizeHandle(handle);
  return normalized.length > 0 ? normalized : UNNAMED;
}

export function channelAgentHandle(
  ownerAgentName: string | null | undefined,
  channelSlug: string,
): string {
  const owner = normalizeHandle(ownerAgentName);
  return `${owner.length > 0 ? owner : UNNAMED}-${channelSlug}`;
}
