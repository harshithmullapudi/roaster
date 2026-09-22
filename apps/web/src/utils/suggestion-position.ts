export function placeSuggestion(
  element: HTMLElement,
  rect: DOMRect | null,
): void {
  if (!rect) return;

  const margin = 8;
  const height = element.offsetHeight || 240;
  const width = element.offsetWidth || 280;

  const above = rect.top - height - margin;
  const below = rect.bottom + margin;

  element.style.position = "fixed";
  element.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))}px`;
  element.style.top = `${above > margin ? above : below}px`;
  element.style.zIndex = "50";
}
