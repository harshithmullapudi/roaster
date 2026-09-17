"use client";

import { authClient } from "@roster/auth/client";
import { nextSlugCandidate, slugify } from "@roster/auth/slug";
import { Button, Input, Label } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const MAX_SLUG_ATTEMPTS = 25;

/**
 * Finds a free slug for the name. Collisions are resolved here rather than by
 * a unique-constraint retry so the user sees the slug they will actually get
 * before they commit to it.
 */
async function claimSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : nextSlugCandidate(base, attempt);
    const { data } = await authClient.organization.checkSlug({
      slug: candidate,
    });
    if (data?.status) return candidate;
  }
  throw new Error(
    `Couldn't find a free URL for "${name}". Try a different name.`,
  );
}

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = useMemo(() => (name.trim() ? slugify(name) : ""), [name]);

  async function submit(event: React.FormEvent) {
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
      router.push(`/${data.slug}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Team name</Label>
        <Input
          id="name"
          name="name"
          required
          autoFocus
          placeholder="Tegon"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {previewSlug ? (
            <>
              Your team lives at{" "}
              <span className="font-mono">/{previewSlug}</span>
            </>
          ) : (
            "You can invite people once it exists."
          )}
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}
