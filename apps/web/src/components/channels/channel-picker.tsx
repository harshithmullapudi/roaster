"use client";

import type { HostProjects } from "@roster/api";
import { Button, Checkbox, Skeleton } from "@roster/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { hostRows, selectedProjects } from "~/utils/host-rows";
import { errorMessage, trpc } from "~/utils/trpc";

import { HostOfflineNotice } from "./host-offline-notice";

export interface ChannelPickerProps {
  addLabel?: string;
  actions?: ReactNode;
  onAdded?: () => void;
}

export function ChannelPicker({
  addLabel = "Add",
  actions,
  onAdded,
}: ChannelPickerProps) {
  const router = useRouter();
  const [hosts, setHosts] = useState<HostProjects[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setHosts(null);
    try {
      setHosts(await trpc.superset.projects.query());
    } catch (cause) {
      setLoadError(errorMessage(cause, "Couldn't reach Superset."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!hosts) return;
    const chosen = selectedProjects(hosts, selected);
    if (chosen.length === 0) return;

    setSaving(true);
    setSaveError(null);

    try {
      await trpc.onboarding.selectProjects.mutate({ projects: chosen });
      setSelected(new Set());
      router.refresh();
      onAdded?.();
      await load();
    } catch (cause) {
      setSaveError(errorMessage(cause, "Couldn't save those channels."));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm">{loadError}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => void load()}>
            Retry
          </Button>
          {actions}
        </div>
      </div>
    );
  }

  if (!hosts) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
  }

  const rows = hostRows(hosts);
  const count = selected.size;

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="border-border rounded border p-3">
          <p className="text-sm">No machines yet</p>
          <code className="bg-grayAlpha-100 mt-2 block rounded px-2 py-1 font-mono text-xs">
            superset start
          </code>
        </div>
      ) : null}

      {rows.map((host) => {
        if (host.status === "asleep") {
          return (
            <HostOfflineNotice
              key={host.id}
              hostName={host.name}
              wakeCommand={host.wakeCommand}
            />
          );
        }

        return (
          <div key={host.id} className="space-y-1.5">
            <p className="text-muted-foreground text-xs">{host.name}</p>

            {host.status === "unreachable" ? (
              <p className="text-destructive text-sm">{host.error}</p>
            ) : host.projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No projects on this machine.
              </p>
            ) : (
              <ul className="border-border divide-y rounded border">
                {host.projects.map((project) => (
                  <li key={project.id}>
                    <label
                      className={
                        project.added
                          ? "flex items-center gap-2.5 px-3 py-2 opacity-60"
                          : "hover:bg-grayAlpha-50 flex cursor-pointer items-center gap-2.5 px-3 py-2"
                      }
                    >
                      <Checkbox
                        checked={project.added || selected.has(project.id)}
                        disabled={project.added}
                        onCheckedChange={() => toggle(project.id)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {project.name}
                      </span>
                      {project.added ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          Added
                        </span>
                      ) : project.repo ? (
                        <span className="text-muted-foreground shrink-0 truncate font-mono text-xs">
                          {project.repo}
                        </span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {saveError ? (
        <p className="text-destructive text-sm">{saveError}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="lg" onClick={save} disabled={saving || count === 0}>
          {saving ? "Adding…" : `${addLabel} ${count || ""}`.trim()}
        </Button>
        {actions}
      </div>
    </div>
  );
}
