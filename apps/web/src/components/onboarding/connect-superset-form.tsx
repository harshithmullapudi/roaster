"use client";

import { Button, Input, Label } from "@roster/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

export function ConnectSupersetForm() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const key = apiKey.trim();
    if (!key) return;

    setPending(true);
    setError(null);

    try {
      await trpc.superset.connect.mutate({ apiKey: key });
      setApiKey("");
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't connect that key."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="api-key" className="sr-only">
        Superset API key
      </Label>
      <Input
        id="api-key"
        name="api-key"
        type="password"
        required
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder="sk_live_…"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        Stored encrypted · Settings → API keys
      </p>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Checking…" : "Connect"}
      </Button>
    </form>
  );
}
