"use client";

import { authClient } from "@roster/auth/client";
import { nextSlugCandidate, slugify } from "@roster/auth/slug";
import { Button, Input, Label } from "@roster/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { errorMessage } from "~/utils/trpc";

const MAX_SLUG_ATTEMPTS = 25;

async function claimSlug(name: string): Promise<string> {
  const base = slugify(name);

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : nextSlugCandidate(base, attempt);
    const { data } = await authClient.organization.checkSlug({
      slug: candidate,
    });
    if (data?.status) return candidate;
  }

  throw new Error(`Couldn't find a free URL for "${name}".`);
}

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = useMemo(() => (name.trim() ? slugify(name) : ""), [name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const teamName = name.trim();
    if (!teamName) return;

    setPending(true);
    setError(null);

    try {
      const slug = await claimSlug(teamName);
      const { data, error: createError } =
        await authClient.organization.create({ name: teamName, slug });

      if (createError || !data) {
        throw new Error(createError?.message ?? "Couldn't create the team.");
      }

      await authClient.organization.setActive({ organizationId: data.id });
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Something went wrong."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="name" className="sr-only">
        Workspace name
      </Label>
      <Input
        id="name"
        name="name"
        required
        autoFocus
        placeholder="Workspace name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {previewSlug ? (
        <p className="text-muted-foreground font-mono text-xs">
          /{previewSlug}
        </p>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}
