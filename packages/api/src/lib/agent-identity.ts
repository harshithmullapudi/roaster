export function normalizeHandle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^@/, "");
}

const UNNAMED = "agent";

export function agentDisplay(handle: string | null | undefined): string {
  const normalized = normalizeHandle(handle);
  return normalized.length > 0 ? normalized : UNNAMED;
}

export function channelAgentHandle(channelSlug: string): string {
  const slug = normalizeHandle(channelSlug);
  return slug.length > 0 ? slug : UNNAMED;
}
