export function pausedMessagesLabel(count: number): string {
  return count === 1 ? "1 message" : `${count} messages`;
}
