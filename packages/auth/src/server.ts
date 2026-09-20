import {
  db,
  invitations,
  members,
  organizations,
  sessions,
  users,
  verifications,
  accounts,
} from "@roster/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, oneTimeToken, organization } from "better-auth/plugins";
import { desc, eq } from "drizzle-orm";

import { InvitationEmail } from "./emails/invitation";
import { MagicLinkEmail } from "./emails/magic-link";
import { sendEmail } from "./lib/resend";

const MAGIC_LINK_EXPIRY_MINUTES = 10;
const INVITATION_EXPIRY_DAYS = 7;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users,
      sessions,
      accounts,
      verifications,
      organizations,
      members,
      invitations,
    },
  }),
  trustedOrigins: [appUrl],
  advanced: {
    database: {
      generateId: false,
    },
  },
  emailAndPassword: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const membership = await db.query.members.findFirst({
            where: eq(members.userId, session.userId),
            orderBy: desc(members.createdAt),
          });
          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRY_MINUTES * 60,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Sign in to Roster",
          link: url,
          react: MagicLinkEmail({
            url,
            expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
          }),
        });
      },
    }),
    oneTimeToken({
      disableClientRequest: true,
      storeToken: "hashed",
    }),
    organization({
      creatorRole: "owner",
      invitationExpiresIn: INVITATION_EXPIRY_DAYS * 24 * 60 * 60,
      sendInvitationEmail: async (data) => {
        const url = `${appUrl}/invite/${data.id}`;
        await sendEmail({
          to: data.email,
          subject: `${data.inviter.user.name || data.inviter.user.email} invited you to ${data.organization.name} on Roster`,
          link: url,
          react: InvitationEmail({
            inviterName: data.inviter.user.name || data.inviter.user.email,
            organizationName: data.organization.name,
            url,
            expiresInDays: INVITATION_EXPIRY_DAYS,
          }),
        });
      },
    }),
  ],
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
