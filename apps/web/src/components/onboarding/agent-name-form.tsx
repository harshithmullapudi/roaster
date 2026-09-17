"use client";

import { Button, Input, Label } from "@roster/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

export interface AgentNameFormProps {
  exampleChannel: string;
}

export function AgentNameForm({ exampleChannel }: AgentNameFormProps) {
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = agentName.trim().toLowerCase();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = agentName.trim();
    if (!name) return;

    setPending(true);
    setError(null);

    try {
      await trpc.onboarding.setAgentName.mutate({ agentName: name });
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't save that name."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="agent-name" className="sr-only">
        Agent name
      </Label>
      <Input
        id="agent-name"
        name="agent-name"
        required
        autoFocus
        autoComplete="off"
        placeholder="Fern"
        value={agentName}
        onChange={(event) => setAgentName(event.target.value)}
      />
      {handle ? (
        <p className="text-muted-foreground font-mono text-xs">
          @{handle}-[{exampleChannel}]
        </p>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Saving…" : "Finish"}
      </Button>
    </form>
  );
}
