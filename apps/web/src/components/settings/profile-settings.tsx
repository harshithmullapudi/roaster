"use client";

import { authClient } from "@roster/auth/client";
import { useRouter } from "next/navigation";

import { trpc } from "~/utils/trpc";

import { InlineTextSetting } from "./inline-text-setting";

export function NameSetting({ initialName }: { initialName: string }) {
  const router = useRouter();

  return (
    <InlineTextSetting
      label="Your name"
      description="How your messages are signed in every channel."
      placeholder="Harshith"
      initialValue={initialName}
      errorFallback="Couldn't save that name."
      onSave={async (name) => {
        const { error } = await authClient.updateUser({ name });
        if (error) throw new Error(error.message ?? "Couldn't save that name.");
        router.refresh();
      }}
    />
  );
}

export function AgentNameSetting({
  initialName,
  exampleChannel,
}: {
  initialName: string;
  exampleChannel: string;
}) {
  const router = useRouter();

  return (
    <InlineTextSetting
      label="Agent name"
      description="The handle teammates use to hand work to your agent."
      placeholder="fern"
      initialValue={initialName}
      errorFallback="Couldn't save that name."
      hint={(value) =>
        value ? (
          <p className="text-muted-foreground font-mono text-xs">
            @{value.toLowerCase()}-[{exampleChannel}]
          </p>
        ) : null
      }
      onSave={async (agentName) => {
        await trpc.onboarding.setAgentName.mutate({ agentName });
        router.refresh();
      }}
    />
  );
}
