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
import { Check, Mail } from "lucide-react";
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
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Mail size={14} className="text-muted-foreground" />
        Invite someone
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        They&rsquo;ll get an email with their own link. It expires in 7 days.
      </p>

      {/*
        One row of controls, all the same height — the labels are read out but
        not drawn, since the placeholder and the role itself already say what
        each one is.
      */}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="invite-email" className="sr-only">
            Email
          </Label>
          <Input
            id="invite-email"
            type="email"
            required
            placeholder="teammate@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="sm:w-28">
          <Label htmlFor="invite-role" className="sr-only">
            Role
          </Label>
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
        {/* `lg` is 32px — the one button size that matches --input-h. */}
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
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <Check size={13} className="text-foreground" />
          Invitation sent to {sentTo}. Copy their link below if the email
          doesn&rsquo;t arrive.
        </p>
      ) : null}
    </section>
  );
}
