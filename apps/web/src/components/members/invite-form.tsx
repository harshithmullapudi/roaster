"use client";

import { authClient } from "@roster/auth/client";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@roster/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export interface InviteFormProps {
  organizationId: string;
}

export function InviteForm({ organizationId }: InviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;

    setPending(true);
    setError(null);
    setSentTo(null);

    const { error: inviteError } = await authClient.organization.inviteMember({
      email: address,
      role: role as "member" | "admin" | "owner",
      organizationId,
    });

    setPending(false);
    if (inviteError) {
      setError(inviteError.message ?? "Couldn't send that invitation.");
      return;
    }

    setEmail("");
    setSentTo(address);
    router.refresh();
  }

  return (
    <section className="bg-background-3 text-foreground rounded p-4">
      <h2 className="text-sm font-medium">Invite someone</h2>
      <p className="text-muted-foreground mt-0.5 text-sm">
        They&rsquo;ll get an email with a link. It expires in 7 days.
      </p>

      <form
        onSubmit={submit}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            placeholder="teammate@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:w-28">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="invite-role" showIcon>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={pending}
        >
          {pending ? "Sending…" : "Invite"}
        </Button>
      </form>

      {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
      {sentTo ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Invitation sent to {sentTo}.
        </p>
      ) : null}
    </section>
  );
}
