export const CHANNEL_VISIBILITIES = ["public", "private"] as const;
export type ChannelVisibility = (typeof CHANNEL_VISIBILITIES)[number];

export function normalizeVisibility(
  value: string | null | undefined,
): ChannelVisibility {
  return value === "private" ? "private" : "public";
}
