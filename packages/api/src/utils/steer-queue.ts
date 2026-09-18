export function mergeSteers(queue: string[]): string {
  return queue
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join("\n\n");
}

export function undeliveredSteerNotice(count: number, reason: string): string {
  const noun = count === 1 ? "message" : "messages";
  return `${count} ${noun} never reached the agent — ${reason} Send ${count === 1 ? "it" : "them"} again.`;
}
