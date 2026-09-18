"use client";

import { Button } from "@roster/ui";
import Link from "next/link";

import { ChannelPicker } from "~/components/channels/channel-picker";

export function ProjectPicker() {
  return (
    <ChannelPicker
      actions={
        <Button variant="ghost" size="lg" asChild>
          <Link href="/onboarding?step=agent">Skip</Link>
        </Button>
      }
    />
  );
}
