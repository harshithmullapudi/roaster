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

export interface CreateTeamFormProps {
  initialUserName: string;
}

export function CreateTeamForm({ initialUserName }: CreateTeamFormProps) {
  const router = useRouter();
  const [userName, setUserName] = useState(initialUserName);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = useMemo(() => (name.trim() ? slugify(name) : ""), [name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const teamName = name.trim();
    const person = userName.trim();
    if (!teamName || !person) return;

    setPending(true);
    setError(null);

    try {
      if (person !== initialUserName) {
        const { error: nameError } = await authClient.updateUser({
          name: person,
        });
        if (nameError) {
          throw new Error(nameError.message ?? "Couldn't save your name.");
        }
      }

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
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="user-name">Your name</Label>
        <Input
          id="user-name"
          name="user-name"
          required
          autoFocus
          autoComplete="name"
          placeholder="Harshith Mullapudi"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          How your messages are signed in every channel.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Tegon"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {previewSlug ? (
          <p className="text-muted-foreground font-mono text-xs">
            /{previewSlug}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Creating…" : "Continue"}
      </Button>
    </form>
  );
}
