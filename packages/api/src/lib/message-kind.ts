export const DELEGATION_KIND = "delegation";

export function hiddenFromChannel(kind: string): boolean {
  return kind === DELEGATION_KIND;
}
