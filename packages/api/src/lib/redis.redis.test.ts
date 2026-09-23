import { afterAll, describe, expect, it } from "vitest";

import {
  acquireLease,
  closeRedis,
  createRedis,
  hasRedis,
  releaseLease,
  renewLease,
} from "./redis";

const client = hasRedis() ? createRedis("worker") : null;

afterAll(async () => {
  if (client) await client.quit();
  await closeRedis();
});

function key(name: string): string {
  return `roster:test:lease:${name}`;
}

describe.skipIf(!hasRedis())("a lease", () => {
  it("is held by whoever took it first", async () => {
    const name = key("first");
    await client!.del(name);

    expect(await acquireLease(client!, name, "worker-a", 5000)).toBe(true);
    expect(await acquireLease(client!, name, "worker-b", 5000)).toBe(false);

    await client!.del(name);
  });

  it("is renewed only by its holder", async () => {
    const name = key("renew");
    await client!.del(name);

    await acquireLease(client!, name, "worker-a", 5000);

    expect(await renewLease(client!, name, "worker-a", 5000)).toBe(true);
    expect(await renewLease(client!, name, "worker-b", 5000)).toBe(false);

    await client!.del(name);
  });

  it("is released only by its holder", async () => {
    const name = key("release");
    await client!.del(name);

    await acquireLease(client!, name, "worker-a", 5000);

    expect(await releaseLease(client!, name, "worker-b")).toBe(false);
    expect(await client!.get(name)).toBe("worker-a");

    expect(await releaseLease(client!, name, "worker-a")).toBe(true);
    expect(await client!.get(name)).toBeNull();
  });

  it("expires on its own so a dead holder does not keep it", async () => {
    const name = key("expire");
    await client!.del(name);

    expect(await acquireLease(client!, name, "worker-a", 120)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(await client!.get(name)).toBeNull();
    expect(await acquireLease(client!, name, "worker-b", 5000)).toBe(true);

    await client!.del(name);
  });

  it("cannot be renewed once it has expired", async () => {
    const name = key("renew-expired");
    await client!.del(name);

    await acquireLease(client!, name, "worker-a", 120);
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(await renewLease(client!, name, "worker-a", 5000)).toBe(false);
    expect(await client!.get(name)).toBeNull();
  });
});
