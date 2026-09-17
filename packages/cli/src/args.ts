/**
 * A small flag parser. Agents type these commands, so the rules are the ones
 * an agent will guess: `--flag value` and `--flag=value` both work, and
 * everything that is not a flag is a positional in order.
 */

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const body = token.slice(2);
    const equals = body.indexOf("=");

    if (equals !== -1) {
      flags[body.slice(0, equals)] = body.slice(equals + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      index += 1;
    } else {
      flags[body] = true;
    }
  }

  return { positionals, flags };
}

export function flagString(
  parsed: ParsedArgs,
  name: string,
): string | undefined {
  const value = parsed.flags[name];
  return typeof value === "string" ? value : undefined;
}

export function flagNumber(
  parsed: ParsedArgs,
  name: string,
): number | undefined {
  const raw = flagString(parsed, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
