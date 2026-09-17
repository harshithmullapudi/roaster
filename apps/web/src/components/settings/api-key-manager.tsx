"use client";

import { Button, Input } from "@roster/ui";
import { Check, Copy, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Shown once — the server never returns a full key again. */
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      setKeys(await trpc.apiKeys.list.query());
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't load your keys."));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setPending(true);
    setError(null);
    try {
      const key = await trpc.apiKeys.create.mutate({ name: name.trim() });
      setMinted(key.key);
      setName("");
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't create that key."));
    } finally {
      setPending(false);
    }
  }

  async function revoke(keyId: string) {
    setError(null);
    try {
      await trpc.apiKeys.revoke.mutate({ keyId });
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't revoke that key."));
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-foreground text-base font-medium">API keys</h2>
        <p className="text-muted-foreground text-sm">
          For the <code className="font-mono">roster</code> CLI, which agents
          use to read channels and hand work to each other. A key acts as you —
          it reaches exactly the channels you can.
        </p>
      </div>

      <form onSubmit={create} className="flex gap-2">
        <Input
          placeholder="This machine"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>

      {minted ? (
        <div className="border-border bg-background-3 space-y-2 rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">
            Copy this now — it is not shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-grayAlpha-100 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
              {minted}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(minted);
                setCopied(true);
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          <p className="text-muted-foreground font-mono text-xs">
            npm i -g @roster/cli && roster login
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMinted(null);
              setCopied(false);
            }}
          >
            Done
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No keys yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="text-foreground font-medium">{key.name}</span>
              <code className="text-muted-foreground font-mono text-xs">
                {key.prefix}…
              </code>
              <span className="text-muted-foreground ml-auto text-xs">
                {key.lastUsedAt
                  ? `used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                  : "never used"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Revoke ${key.name}`}
                onClick={() => void revoke(key.id)}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
