const TYPING_SAFE_MODIFIERS = new Set(["$mod", "Meta", "Control"]);

export function firesWhileTyping(key: string): boolean {
  const presses = key.trim().split(" ").filter(Boolean);
  if (presses.length === 0) return false;

  return presses.every((press) => {
    const modifiers = press.split("+");
    modifiers.pop();
    return modifiers.some((modifier) => TYPING_SAFE_MODIFIERS.has(modifier));
  });
}
