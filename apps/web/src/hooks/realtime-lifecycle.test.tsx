// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const connected = new Set<object>();

  class FakeSubscription {
    on() {
      return this;
    }
    subscribe() {}
  }

  class FakeCentrifuge {
    constructor(
      public url: string,
      public options: unknown,
    ) {}
    on() {
      return this;
    }
    newSubscription() {
      return new FakeSubscription();
    }
    connect() {
      connected.add(this);
    }
    disconnect() {
      connected.delete(this);
    }
  }

  return { connected, FakeCentrifuge };
});

vi.mock("centrifuge", () => ({ Centrifuge: fake.FakeCentrifuge }));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const pending = vi.hoisted(() => ({
  connectionToken: [] as (() => void)[],
  subscriptionToken: [] as (() => void)[],
}));

let connectionToken: Deferred<unknown>;
let subscriptionToken: Deferred<unknown>;

vi.mock("~/utils/trpc", () => ({
  trpc: {
    realtime: {
      connectionToken: { query: () => connectionToken.promise },
      subscriptionToken: { query: () => subscriptionToken.promise },
      threadSubscriptionToken: { query: () => subscriptionToken.promise },
      userSubscriptionToken: { query: () => subscriptionToken.promise },
    },
    messages: { list: { query: () => Promise.resolve([]) } },
    threads: {
      list: { query: () => Promise.resolve([]) },
      get: { query: () => Promise.resolve({ thread: {}, messages: [] }) },
    },
    notifications: { unreadCount: { query: () => Promise.resolve(0) } },
  },
}));

vi.mock("~/utils/desktop-notify", () => ({
  prepareDesktopNotifications: () => Promise.resolve(),
  showDesktopNotification: () => Promise.resolve(),
}));

const { useChannelRealtime } = await import("./use-channel-realtime");
const { useThreadRealtime } = await import("./use-thread-realtime");
const { useUserRealtime } = await import("./use-user-realtime");

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  fake.connected.clear();
  connectionToken = deferred();
  subscriptionToken = deferred();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  container.remove();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function mount(element: React.ReactElement) {
  const client = new QueryClient();
  act(() => {
    root.render(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
}

function unmount() {
  act(() => {
    root.unmount();
  });
}

describe("realtime hooks survive unmount mid-connect", () => {
  it("leaves no channel connection open when unmounted during the token fetch", async () => {
    function Probe() {
      useChannelRealtime("project-1");
      return null;
    }

    mount(<Probe />);
    connectionToken.resolve({
      enabled: true,
      url: "ws://localhost/connection/websocket",
      token: "connection-token",
    });
    await flush();

    unmount();

    subscriptionToken.resolve({
      enabled: true,
      channel: "project:project-1",
      token: "subscription-token",
    });
    await flush();

    expect(fake.connected.size).toBe(0);
  });

  it("leaves no thread connection open when unmounted during the token fetch", async () => {
    function Probe() {
      useThreadRealtime("thread-1", "project-1");
      return null;
    }

    mount(<Probe />);
    connectionToken.resolve({
      enabled: true,
      url: "ws://localhost/connection/websocket",
      token: "connection-token",
    });
    await flush();

    unmount();

    subscriptionToken.resolve({
      enabled: true,
      channel: "thread:thread-1",
      token: "subscription-token",
    });
    await flush();

    expect(fake.connected.size).toBe(0);
  });

  it("leaves no inbox connection open when unmounted during the token fetch", async () => {
    function Probe() {
      useUserRealtime();
      return null;
    }

    mount(<Probe />);
    connectionToken.resolve({
      enabled: true,
      url: "ws://localhost/connection/websocket",
      token: "connection-token",
    });
    await flush();

    unmount();

    subscriptionToken.resolve({
      enabled: true,
      channel: "user:member-1",
      token: "subscription-token",
    });
    await flush();

    expect(fake.connected.size).toBe(0);
  });

  it("closes the connection on a normal unmount", async () => {
    function Probe() {
      useChannelRealtime("project-1");
      return null;
    }

    mount(<Probe />);
    connectionToken.resolve({
      enabled: true,
      url: "ws://localhost/connection/websocket",
      token: "connection-token",
    });
    subscriptionToken.resolve({
      enabled: true,
      channel: "project:project-1",
      token: "subscription-token",
    });
    await flush();

    expect(fake.connected.size).toBe(1);

    unmount();
    expect(fake.connected.size).toBe(0);
  });
});
