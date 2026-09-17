"use client";

import { magicLinkClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [magicLinkClient(), organizationClient()],
});

export const {
  signIn,
  signOut,
  useSession,
  organization: organizationApi,
  useListOrganizations,
  useActiveOrganization,
} = authClient;
