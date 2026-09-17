"use client";

import type { HostProjects } from "@roster/api";
import { Button, Checkbox, Skeleton } from "@roster/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

import { HostOfflineNotice } from "./host-offline-notice";

export function ProjectPicker() {
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
    if (!hosts || selected.size === 0) return;

    setSaving(true);
    setSaveError(null);

    const chosen = hosts.flatMap((entry) =>
      entry.projects
        .filter((project) => selected.has(project.id))
        .map((project) => ({
          supersetProjectId: project.id,
          supersetHostId: entry.host.id,
          name: project.name,
          repoOwner: project.repoOwner ?? null,
          repoName: project.repoName ?? null,
          repoUrl: project.repoUrl ?? null,
          repoPath: project.repoPath ?? null,
        })),
    );

    try {
      await trpc.onboarding.selectProjects.mutate({ projects: chosen });
      router.refresh();
    } catch (cause) {
      setSaveError(errorMessage(cause, "Couldn't save those projects."));
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
          <Button variant="ghost" size="lg" asChild>
            <Link href="/onboarding?step=agent">Skip</Link>
          </Button>
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

  const reachable = hosts.filter((entry) => entry.projects.length > 0);
  const asleep = hosts.filter(
    (entry) => entry.projects.length === 0 && !entry.host.online,
  );

  return (
    <div className="space-y-3">
      {hosts.length === 0 ? (
        <div className="border-border rounded border p-3">
          <p className="text-sm">No machines yet</p>
          <code className="bg-grayAlpha-100 mt-2 block rounded px-2 py-1 font-mono text-xs">
            superset start
          </code>
        </div>
      ) : null}

      {reachable.map((entry) => (
        <div key={entry.host.id} className="space-y-1.5">
          <p className="text-muted-foreground text-xs">{entry.host.name}</p>
          <ul className="border-border divide-y rounded border">
            {entry.projects.map((project) => (
              <li key={project.id}>
                <label className="hover:bg-grayAlpha-50 flex cursor-pointer items-center gap-2.5 px-3 py-2">
                  <Checkbox
                    checked={selected.has(project.id)}
                    onCheckedChange={() => toggle(project.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {project.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 truncate font-mono text-xs">
                    {project.repoOwner && project.repoName
                      ? `${project.repoOwner}/${project.repoName}`
                      : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {asleep.map((entry) => (
        <HostOfflineNotice
          key={entry.host.id}
          hostName={entry.host.name}
          wakeCommand={entry.host.wakeCommand}
        />
      ))}

      {saveError ? (
        <p className="text-destructive text-sm">{saveError}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="lg" onClick={save} disabled={saving || selected.size === 0}>
          {saving ? "Adding…" : `Add ${selected.size || ""}`.trim()}
        </Button>
        <Button variant="ghost" size="lg" asChild>
          <Link href="/onboarding?step=agent">Skip</Link>
        </Button>
      </div>
    </div>
  );
}
