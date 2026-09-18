export type DeleteRefusal = "missing" | "not-yours" | "already-deleted";

export interface DeletableMessage {
  kind: string;
  authorMemberId: string | null;
  deletedAt: Date | null;
}

export function deleteRefusal(
  message: DeletableMessage | null,
  memberId: string,
): DeleteRefusal | null {
  if (!message) return "missing";
  if (message.deletedAt) return "already-deleted";
  if (message.kind !== "user") return "not-yours";
  if (message.authorMemberId === null) return "not-yours";
  if (message.authorMemberId !== memberId) return "not-yours";
  return null;
}
