"use client";

import type { SupersetConnection, SupersetOrganization } from "@roster/api";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@roster/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

import { SettingRow, SettingsCard } from "./settings-page";

export function SupersetConnectionSettings() {
  const router = useRouter();
  const [connection, setConnection] = useState<SupersetConnection | null>(null);
  const [organizations, setOrganizations] = useState<SupersetOrganization[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const current = await trpc.superset.connection.query();
      setConnection(current);
      setOrganizations(
        current.connected ? await trpc.superset.organizations.query() : [],
      );
    } catch (cause) {
      setConnection(null);
      setLoadError(errorMessage(cause, "Couldn't reach Superset."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function chooseOrganization(organizationId: string) {
    await trpc.superset.chooseOrganization.mutate({ organizationId });
    await load();
    router.refresh();
  }

  if (loadError) {
    return (
      <SettingsCard>
        <SettingRow label="Superset" description={loadError}>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </SettingRow>
      </SettingsCard>
    );
  }

  if (!connection) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  return (
    <SettingsCard>
      <SettingRow
        label="API key"
        description={
          connection.connected
            ? "Connected. Your agents reach your machines with this key."
            : "Not connected. Paste a key to reach your machines."
        }
      >
        <Button
          variant="secondary"
          onClick={() => setReconnecting((current) => !current)}
        >
          {reconnecting ? "Cancel" : connection.connected ? "Replace" : "Connect"}
        </Button>
      </SettingRow>

      {reconnecting ? (
        <div className="px-4 py-3">
          <ApiKeyForm
            onConnected={async () => {
              setReconnecting(false);
              await load();
              router.refresh();
            }}
          />
        </div>
      ) : null}

      {connection.connected ? (
        <SettingRow
          label="Superset organization"
          description="Which organization's machines this workspace talks to."
        >
          {organizations.length === 0 ? (
            <span className="text-muted-foreground text-sm">
              {connection.organizationName ?? "None chosen"}
            </span>
          ) : (
            <Select
              value={connection.organizationId ?? undefined}
              onValueChange={(value) => void chooseOrganization(value)}
            >
              <SelectTrigger
                showIcon
                aria-label="Superset organization"
                className="w-56"
              >
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </SettingRow>
      ) : null}
    </SettingsCard>
  );
}

function ApiKeyForm({ onConnected }: { onConnected: () => Promise<void> }) {
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
      await onConnected();
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't connect that key."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Superset API key"
          type="password"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="sk_live_…"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Checking…" : "Save"}
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <p className="text-muted-foreground text-xs">Stored encrypted.</p>
    </form>
  );
}
