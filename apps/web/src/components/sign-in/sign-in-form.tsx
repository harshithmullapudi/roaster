"use client";

import { authClient } from "@roster/auth/client";
import { Button, Input, Label } from "@roster/ui";
import { type FormEvent, useState } from "react";

type State =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export interface SignInFormProps {
  callbackURL?: string;
  /** Prefilled when we already know who the link was meant for. */
  initialEmail?: string;
}

export function SignInForm({
  callbackURL = "/",
  initialEmail = "",
}: SignInFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;

    setState({ status: "sending" });
    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL,
    });

    setState(
      error
        ? { status: "error", message: error.message ?? "Something went wrong." }
        : { status: "sent", email: address },
    );
  }

  if (state.status === "sent") {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Link sent to <span className="font-medium">{state.email}</span>.
        </p>
        <Button
          variant="link"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-auto px-0"
          onClick={() => setState({ status: "idle" })}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="email" className="sr-only">
        Email
      </Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      {state.status === "error" ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}

      <Button type="submit" size="lg" full disabled={state.status === "sending"}>
        {state.status === "sending" ? "Sending…" : "Continue with email"}
      </Button>
    </form>
  );
}
