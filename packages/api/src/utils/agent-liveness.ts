export interface WatchSilence {
  now: number;
  bound: boolean;
  transcriptChangedAt: number;
  bindingChangedAt: number;
  timeoutMs: number;
}

export function agentIsGone(silence: WatchSilence): boolean {
  if (silence.bound) return false;
  return (
    silence.now - silence.transcriptChangedAt >= silence.timeoutMs &&
    silence.now - silence.bindingChangedAt >= silence.timeoutMs
  );
}
