import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_API_URL, loadConfig, saveConfig } from "./config.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "roster-config-"));
  path = join(dir, "config.json");
  process.env.ROSTER_CONFIG = path;
  delete process.env.ROSTER_TOKEN;
  delete process.env.ROSTER_API_URL;
});

afterEach(() => {
  delete process.env.ROSTER_CONFIG;
  delete process.env.ROSTER_TOKEN;
  delete process.env.ROSTER_API_URL;
  rmSync(dir, { recursive: true, force: true });
});

describe("DEFAULT_API_URL", () => {
  it("points at a hosted Roster, so an install with no flags can reach one", () => {
    expect(DEFAULT_API_URL).toMatch(/^https:\/\//);
  });
});

describe("loadConfig", () => {
  it("returns null when the machine has never logged in", () => {
    expect(loadConfig()).toBeNull();
  });

  it("returns null when the config file holds no token", () => {
    writeFileSync(path, JSON.stringify({ apiUrl: "https://a.example" }));
    expect(loadConfig()).toBeNull();
  });

  it("reads a saved login", () => {
    saveConfig({ apiUrl: "https://a.example", token: "k1" });
    expect(loadConfig()).toEqual({ apiUrl: "https://a.example", token: "k1" });
  });

  it("falls back to the default host for a config file that omits one", () => {
    writeFileSync(path, JSON.stringify({ token: "k1" }));
    expect(loadConfig()?.apiUrl).toBe(DEFAULT_API_URL);
  });

  it("lets ROSTER_TOKEN win over a saved login", () => {
    saveConfig({ apiUrl: "https://saved.example", token: "saved" });
    process.env.ROSTER_TOKEN = "from-env";
    expect(loadConfig()).toEqual({
      apiUrl: DEFAULT_API_URL,
      token: "from-env",
    });
  });

  it("pairs ROSTER_API_URL with ROSTER_TOKEN", () => {
    process.env.ROSTER_TOKEN = "from-env";
    process.env.ROSTER_API_URL = "https://env.example";
    expect(loadConfig()?.apiUrl).toBe("https://env.example");
  });

  it("ignores a blank ROSTER_TOKEN rather than authenticating with it", () => {
    saveConfig({ apiUrl: "https://saved.example", token: "saved" });
    process.env.ROSTER_TOKEN = "   ";
    expect(loadConfig()?.token).toBe("saved");
  });
});

describe("saveConfig", () => {
  it("writes the credential unreadable to anyone else", () => {
    saveConfig({ apiUrl: DEFAULT_API_URL, token: "k1" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
