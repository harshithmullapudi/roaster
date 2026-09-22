export interface DraftScope {
  projectId: string;
  threadId?: string;
}

const PREFIX = "roster.draft";

export function draftKey({ projectId, threadId }: DraftScope): string {
  return threadId
    ? `${PREFIX}:thread:${threadId}`
    : `${PREFIX}:channel:${projectId}`;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

interface ProseMirrorNode {
  type?: string;
  text?: string;
  content?: ProseMirrorNode[];
}

export function isEmptyDoc(doc: unknown): boolean {
  function hasSubstance(node: ProseMirrorNode): boolean {
    if (node.type === "text") return (node.text ?? "").trim().length > 0;
    if (node.content === undefined) {
      return node.type !== undefined && node.type !== "paragraph";
    }
    return node.content.some(hasSubstance);
  }

  const root = doc as ProseMirrorNode | null | undefined;
  if (!root) return true;
  return !hasSubstance(root);
}

export function readDraft(key: string): unknown | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, doc: unknown): void {
  const store = storage();
  if (!store) return;

  if (isEmptyDoc(doc)) {
    clearDraft(key);
    return;
  }

  try {
    store.setItem(key, JSON.stringify(doc));
  } catch {
    return;
  }
}

export function clearDraft(key: string): void {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(key);
  } catch {
    return;
  }
}
