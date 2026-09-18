/**
 * Enter is contested: the composer wants to send, the mention popup wants to
 * accept its highlighted item, and an IME wants to commit a candidate. Deciding
 * that in one pure predicate keeps the rule testable — `editorProps` is the
 * only place ProseMirror lets us see the event, and it is not a nice place to
 * reason about.
 */

export interface ComposerKeyEvent {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
}

export interface ComposerKeyContext {
  /** The mention suggestion plugin is showing a list right now. */
  suggestionOpen: boolean;
  touchKeyboard: boolean;
}

export function submitsOnEnter(
  event: ComposerKeyEvent,
  context: ComposerKeyContext,
): boolean {
  if (event.key !== "Enter" || event.shiftKey) return false;
  // 229 is the keyCode browsers report while an IME holds the keystroke.
  if (event.isComposing || event.keyCode === 229) return false;
  if (context.suggestionOpen) return false;
  if (context.touchKeyboard) return false;
  return true;
}
