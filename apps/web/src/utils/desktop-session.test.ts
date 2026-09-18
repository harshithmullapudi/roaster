import { describe, expect, it, vi } from "vitest";

import { desktopSession, safeNext } from "./desktop-session";

const verified = (...cookies: string[]) =>
  vi.fn(async () =>
    new Response(null, {
      headers: cookies.map((cookie): [string, string] => ["set-cookie", cookie]),
    }),
  );

describe("desktopSession", () => {
  it("carries better-auth's cookie onto the redirect, which is how the webview gets a session", async () => {
    const verify = verified("roster.session_token=abc; Path=/; HttpOnly");

    const response = await desktopSession({ token: "ott", verify });

    expect(verify).toHaveBeenCalledWith("ott");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.getSetCookie()).toEqual([
      "roster.session_token=abc; Path=/; HttpOnly",
    ]);
  });

  it("forwards every cookie, not just the first", async () => {
    const response = await desktopSession({
      token: "ott",
      verify: verified("roster.session_token=abc", "roster.session_data=xyz"),
    });

    expect(response.headers.getSetCookie()).toEqual([
      "roster.session_token=abc",
      "roster.session_data=xyz",
    ]);
  });

  it("sends a missing token back to sign-in without asking better-auth", async () => {
    const verify = vi.fn();

    const response = await desktopSession({ token: null, verify });

    expect(verify).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("/sign-in?error=desktop");
  });

  it("treats a blank token as missing", async () => {
    const verify = vi.fn();

    const response = await desktopSession({ token: "   ", verify });

    expect(verify).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("/sign-in?error=desktop");
  });

  it("sends a spent or expired token back to sign-in", async () => {
    const response = await desktopSession({
      token: "ott",
      verify: async () => new Response("invalid token", { status: 400 }),
    });

    expect(response.headers.get("location")).toBe("/sign-in?error=desktop");
  });

  it("keeps cookies from a rejected verification out of the response", async () => {
    const response = await desktopSession({
      token: "ott",
      verify: async () =>
        new Response(null, {
          status: 400,
          headers: { "set-cookie": "roster.session_token=nope" },
        }),
    });

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("sends a thrown verification back to sign-in rather than a 500", async () => {
    const response = await desktopSession({
      token: "ott",
      verify: async () => {
        throw new Error("database is on fire");
      },
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/sign-in?error=desktop");
  });

  it("lands on the page sign-in was headed for, so a desktop invite still gets accepted", async () => {
    const response = await desktopSession({
      token: "ott",
      next: "/join/abc123",
      verify: verified("roster.session_token=abc"),
    });

    expect(response.headers.get("location")).toBe("/join/abc123");
  });

  it("refuses to bounce the webview off-origin", async () => {
    const response = await desktopSession({
      token: "ott",
      next: "//evil.example.com",
      verify: verified("roster.session_token=abc"),
    });

    expect(response.headers.get("location")).toBe("/");
  });
});

describe("safeNext", () => {
  it("keeps an in-app path", () => {
    expect(safeNext("/join/abc")).toBe("/join/abc");
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/tasks?filter=open")).toBe("/tasks?filter=open");
  });

  it("falls back to the root for anything that could leave the origin", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("//evil.example.com")).toBe("/");
    expect(safeNext("/\\evil.example.com")).toBe("/");
    expect(safeNext("https://evil.example.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("/path with spaces")).toBe("/");
  });
});
