export function generateOklchColor(): string {
  const hue = Math.floor(Math.random() * (360 - 30 + 1)) + 30;

  const lightness = 66;
  const chroma = 0.1835;

  const oklchColor = `oklch(${lightness}% ${chroma} ${hue})`;

  return oklchColor;
}

export function getStatusColor(slot: string): {
  background: string;
  color: string;
} {
  if (/^#[0-9A-F]{6}[0-9a-f]{0,2}$/i.test(slot)) {
    return { background: `${slot}26`, color: slot };
  }

  return {
    background: `var(--status-pill-${slot})`,
    color: `var(--status-icon-${slot})`,
  };
}

export function getTailwindColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % 12;

  return `var(--custom-color-${index + 1})`;
}
