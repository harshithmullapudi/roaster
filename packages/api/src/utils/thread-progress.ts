import { stripEnvelope } from "./roster-envelope";

const MAX_PROGRESS_LENGTH = 160;

const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const OTHER_ESCAPE = /\x1b[()#][0-9A-Za-z]|\x1b[=>]/g;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const CARRIAGE = /\r/g;
const ROLE_PREFIX = /^(?:Assistant|User):[ \t]*/;
const CHROME_ONLY = /^[\s\u2500-\u259f\u25a0-\u25ff\u2022\u00b7*>|_=+-]+$/;

export function stripAnsi(value: string): string {
  return value
    .replace(OSC, "")
    .replace(CSI, "")
    .replace(OTHER_ESCAPE, "")
    .replace(CARRIAGE, "\n")
    .replace(CONTROL, "");
}

function isChrome(line: string): boolean {
  if (line.length === 0) return false;
  if (CHROME_ONLY.test(line)) return true;
  return !/[A-Za-z0-9]/.test(line);
}

/**
 * Terminal agents redraw their whole frame, so the useful line is the last one
 * carrying words — box rules, spinners and prompt chrome are not progress.
 */
export function lastMeaningfulLine(transcript: string): string | null {
  const lines = stripEnvelope(stripAnsi(transcript)).split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = (lines[index] ?? "").trim().replace(ROLE_PREFIX, "");
    if (line.length === 0 || isChrome(line)) continue;
    return line.length > MAX_PROGRESS_LENGTH
      ? `${line.slice(0, MAX_PROGRESS_LENGTH - 1).trimEnd()}…`
      : line;
  }
  return null;
}

/**
 * What the agent leaves behind when it finishes: the readable tail of the
 * transcript, with redraw chrome dropped and blank runs collapsed.
 */
export function transcriptTail(transcript: string, maxLines = 40): string {
  const lines = stripEnvelope(stripAnsi(transcript))
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""));

  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isChrome(trimmed)) continue;
    if (trimmed.length === 0 && (kept[kept.length - 1] ?? "").trim() === "") {
      continue;
    }
    kept.push(line);
  }

  while (kept.length > 0 && (kept[0] ?? "").trim() === "") kept.shift();
  while (kept.length > 0 && (kept[kept.length - 1] ?? "").trim() === "") {
    kept.pop();
  }

  return kept.slice(-maxLines).join("\n");
}

const ASSISTANT_TURN = /^Assistant:[ \t]*/gm;

/**
 * The harness transcript replays the whole conversation, prompt echoes and
 * all. Only the newest assistant turn belongs in the channel — the user's own
 * words are already the root message above it.
 */
export function agentReply(transcript: string): string {
  const tail = transcriptTail(transcript, 200);

  let lastIndex = -1;
  let lastLength = 0;
  ASSISTANT_TURN.lastIndex = 0;
  for (
    let match = ASSISTANT_TURN.exec(tail);
    match !== null;
    match = ASSISTANT_TURN.exec(tail)
  ) {
    lastIndex = match.index;
    lastLength = match[0].length;
  }

  if (lastIndex === -1) return tail;
  return tail.slice(lastIndex + lastLength).trim();
}
