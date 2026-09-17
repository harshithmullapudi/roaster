"use client";

import type { SupersetOrganization } from "@roster/api";
import { Button, Skeleton, cn } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

export function ChooseOrganizationForm() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<
    SupersetOrganization[] | null
  >(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const orgs = await trpc.superset.organizations.query();
      setOrganizations(orgs);
      setSelected(orgs[0]?.id ?? null);
    } catch (cause) {
      setLoadError(errorMessage(cause, "Couldn't reach Superset."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await trpc.superset.chooseOrganization.mutate({
        organizationId: selected,
      });
      router.refresh();
    } catch (cause) {
      setSaveError(errorMessage(cause, "Couldn't save that choice."));
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm">{loadError}</p>
        <Button variant="secondary" size="lg" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!organizations) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="border-border divide-y rounded border">
        {organizations.map((org) => (
          <li key={org.id}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2.5",
                selected === org.id ? "bg-grayAlpha-50" : "hover:bg-grayAlpha-50",
              )}
            >
              <input
                type="radio"
                name="superset-org"
                className="accent-primary size-3.5"
                checked={selected === org.id}
                onChange={() => setSelected(org.id)}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{org.name}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {org.slug}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {saveError ? <p className="text-destructive text-sm">{saveError}</p> : null}

      <Button size="lg" full onClick={save} disabled={saving || !selected}>
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
