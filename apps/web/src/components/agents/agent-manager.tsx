"use client";

import { Badge, Button, Input } from "@roster/ui";
import { Check, Plus, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

export interface AgentRow {
  id: string;
  handle: string;
  brief: string | null;
  projectId: string;
  channelSlug: string;
  main: boolean;
}

export interface ChannelOption {
  id: string;
  slug: string;
}

export interface AgentManagerProps {
  agents: AgentRow[];
  channels: ChannelOption[];
}

export function AgentManager({ agents, channels }: AgentManagerProps) {
  const [rows, setRows] = useState(agents);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const byChannel = useMemo(() => {
    const grouped = new Map<string, AgentRow[]>();
    for (const agent of rows) {
      grouped.set(agent.projectId, [
        ...(grouped.get(agent.projectId) ?? []),
        agent,
      ]);
    }
    return grouped;
  }, [rows]);

  const listed = channels.filter((channel) => byChannel.has(channel.id));

  async function created(agent: AgentRow) {
    setRows((current) =>
      current.some((row) => row.id === agent.id)
        ? current
        : [...current, agent],
    );
    setAdding(null);
  }

  async function archive(agent: AgentRow) {
    setError(null);
    try {
      await trpc.agents.archive.mutate({ agentId: agent.id });
      setRows((current) => current.filter((row) => row.id !== agent.id));
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't archive that agent."));
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-foreground text-base font-medium">Agents</h2>
        <p className="text-muted-foreground text-sm">
          Each channel answers as an agent. Give a channel more of them — a PM,
          a reviewer — and they work in the same worktree, taking turns. Anyone
          can reach one with <code className="font-mono">@handle</code>, and an
          agent can hand work to another with{" "}
          <code className="font-mono">roster ask</code>.
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {listed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No channels yet. Connect a folder and its agent appears here.
        </p>
      ) : null}

      {listed.map((channel) => {
        const theirs = byChannel.get(channel.id) ?? [];

        return (
          <div key={channel.id} className="flex flex-col gap-2">
            <div className="flex items-end justify-between gap-3">
              <h3 className="text-sm font-medium">#{channel.slug}</h3>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setAdding(adding === channel.id ? null : channel.id)
                }
              >
                {adding === channel.id ? <X size={14} /> : <Plus size={14} />}
                {adding === channel.id ? "Cancel" : "Add agent"}
              </Button>
            </div>

            <ul className="bg-background-3 flex flex-col divide-y rounded-lg">
              {theirs.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onArchive={() => archive(agent)}
                />
              ))}
            </ul>

            {adding === channel.id ? (
              <NewAgentForm
                channelId={channel.id}
                onCreated={created}
                onError={setError}
              />
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function AgentCard({
  agent,
  onArchive,
}: {
  agent: AgentRow;
  onArchive: () => void;
}) {
  const [brief, setBrief] = useState(agent.brief ?? "");
  const [saved, setSaved] = useState(agent.brief ?? "");
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = brief.trim() !== saved.trim();

  async function save() {
    setPending(true);
    setError(null);
    setJustSaved(false);

    const next = brief.trim();
    try {
      await trpc.agents.setBrief.mutate({
        agentId: agent.id,
        brief: next.length > 0 ? next : null,
      });
      setSaved(next);
      setJustSaved(true);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't save that brief."));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <code className="text-foreground font-mono text-sm">
          @{agent.handle}
        </code>
        {agent.main ? (
          <Badge variant="secondary" className="shrink-0">
            channel agent
          </Badge>
        ) : null}
        {justSaved && !dirty ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Check size={12} />
            saved
          </span>
        ) : null}
        {!agent.main ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto"
            onClick={onArchive}
          >
            Archive
          </Button>
        ) : null}
      </div>

      <textarea
        aria-label={`Brief for @${agent.handle}`}
        value={brief}
        onChange={(event) => {
          setBrief(event.target.value);
          setJustSaved(false);
        }}
        rows={3}
        placeholder={
          agent.main
            ? "Anything every session on this channel should know."
            : "What this one is here to do. It is read at the top of every session."
        }
        className="border-border bg-background focus-visible:ring-ring min-h-16 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-1"
      />

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {dirty ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save brief"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBrief(saved)}
            disabled={pending}
          >
            Revert
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function NewAgentForm({
  channelId,
  onCreated,
  onError,
}: {
  channelId: string;
  onCreated: (agent: AgentRow) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || pending) return;

    setPending(true);
    onError(null);
    try {
      const made = await trpc.agents.create.mutate({
        channelId,
        name: name.trim(),
        brief: brief.trim() || undefined,
      });
      onCreated(made);
      setName("");
      setBrief("");
    } catch (cause) {
      onError(errorMessage(cause, "Couldn't create that agent."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-border flex flex-col gap-2 rounded-lg border border-dashed p-3"
    >
      <Input
        placeholder="pm"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="max-w-xs"
        aria-label="Agent name"
      />
      <p className="text-muted-foreground text-xs">
        The name is suffixed to the channel's own handle, so{" "}
        <code className="font-mono">pm</code> becomes{" "}
        <code className="font-mono">@&lt;channel-agent&gt;-pm</code>.
      </p>
      <textarea
        placeholder="Own the spec. Ask about scope, not syntax."
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        rows={2}
        aria-label="Brief"
        className="border-border bg-background focus-visible:ring-ring min-h-12 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-1"
      />
      <div>
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create agent"}
        </Button>
      </div>
    </form>
  );
}
