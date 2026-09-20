export interface ComposerKeyEvent {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
}

export interface ComposerKeyContext {
  suggestionOpen: boolean;
  touchKeyboard: boolean;
}

export function submitsOnEnter(
  event: ComposerKeyEvent,
  context: ComposerKeyContext,
): boolean {
  if (event.key !== "Enter" || event.shiftKey) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  if (context.suggestionOpen) return false;
  if (context.touchKeyboard) return false;
  return true;
}
