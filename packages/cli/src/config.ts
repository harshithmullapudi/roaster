import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Config {
  apiUrl: string;
  token: string;
}

export const DEFAULT_API_URL = "https://web-production-86be2.up.railway.app";

export function configPath(): string {
  return (
    process.env.ROSTER_CONFIG ?? join(homedir(), ".roster", "config.json")
  );
}

export function loadConfig(): Config | null {
  const fromEnv = process.env.ROSTER_TOKEN;
  if (fromEnv && fromEnv.trim().length > 0) {
    return {
      apiUrl: process.env.ROSTER_API_URL ?? DEFAULT_API_URL,
      token: fromEnv.trim(),
    };
  }

  try {
    const raw = readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    if (!parsed.token) return null;
    return {
      apiUrl: parsed.apiUrl ?? DEFAULT_API_URL,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): string {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}
