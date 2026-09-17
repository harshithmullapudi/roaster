"use client";

import { authClient } from "@roster/auth/client";
import { Button, Input, Label } from "@roster/ui";
import { useState } from "react";

type State =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export function SignInForm({ callbackURL = "/" }: { callbackURL?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(event: React.FormEvent) {
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
          A sign-in link is on its way to{" "}
          <span className="font-medium">{state.email}</span>.
        </p>
        <p className="text-muted-foreground text-sm">
          It expires in 10 minutes and works once.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setState({ status: "idle" })}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
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
      </div>

      {state.status === "error" ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={state.status === "sending"}
      >
        {state.status === "sending" ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
