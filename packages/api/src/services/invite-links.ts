import { randomBytes } from "node:crypto";

import {
  db,
  invitations,
  members,
  organizations,
  orgInviteLinks,
} from "@roster/db";
import { and, eq } from "drizzle-orm";

/**
 * How long a join link lasts. Matches an emailed invitation, so "it expires in
 * a week" is true of every way into a workspace.
 */
export const INVITE_LINK_TTL_DAYS = 7;

/** What a link grants. Not settable: a shared link that mints admins is a trap. */
const LINK_ROLE = "member";

export interface InviteLink {
  token: string;
  role: string;
  expiresAt: Date;
  expired: boolean;
}

function expiry(): Date {
  return new Date(Date.now() + INVITE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * A bearer credential that travels in a URL, so it is random rather than a
 * uuid — 32 bytes, url-safe, nothing about it derivable from the workspace.
 */
function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

function toLink(row: {
  token: string;
  role: string;
  expiresAt: Date;
}): InviteLink {
  return {
    token: row.token,
    role: row.role,
    expiresAt: row.expiresAt,
    expired: row.expiresAt.getTime() < Date.now(),
  };
}

/**
 * The workspace's link, expired or not — an expired one is still shown, since
 * seeing it stale next to a Refresh button explains itself.
 */
export async function inviteLink(
  organizationId: string,
): Promise<InviteLink | null> {
  const row = await db.query.orgInviteLinks.findFirst({
    where: eq(orgInviteLinks.organizationId, organizationId),
  });

  if (!row || row.revokedAt) return null;
  return toLink(row);
}

/**
 * Create the link, or refresh it. Both mint a new token and restart the clock,
 * which is what makes Refresh a repair for a link that got out: the old one
 * stops working the moment this returns.
 */
export async function refreshInviteLink(args: {
  organizationId: string;
  memberId: string;
}): Promise<InviteLink> {
  const token = mintToken();
  const expiresAt = expiry();

  const [row] = await db
    .insert(orgInviteLinks)
    .values({
      organizationId: args.organizationId,
      token,
      role: LINK_ROLE,
      createdByMemberId: args.memberId,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: orgInviteLinks.organizationId,
      set: {
        token,
        role: LINK_ROLE,
        createdByMemberId: args.memberId,
        expiresAt,
        revokedAt: null,
      },
    })
    .returning();

  if (!row) throw new Error("Could not create an invite link.");
  return toLink(row);
}

export async function revokeInviteLink(organizationId: string): Promise<void> {
  await db
    .update(orgInviteLinks)
    .set({ revokedAt: new Date() })
    .where(eq(orgInviteLinks.organizationId, organizationId));
}

export type LinkRefusal = "unknown" | "revoked" | "expired";

export interface ResolvedInviteLink {
  organization: { id: string; name: string; slug: string };
  role: string;
  /** The member who opened the door, as the invitation's inviter of record. */
  createdByUserId: string | null;
}

/**
 * What a join link points at. Returns why it will not work rather than null,
 * so the page can say "that link expired" instead of "not found" — the two
 * mean very different things to whoever was sent it.
 */
export async function resolveInviteLink(
  token: string,
): Promise<ResolvedInviteLink | LinkRefusal> {
  const [row] = await db
    .select({
      revokedAt: orgInviteLinks.revokedAt,
      expiresAt: orgInviteLinks.expiresAt,
      role: orgInviteLinks.role,
      organizationId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      createdByUserId: members.userId,
    })
    .from(orgInviteLinks)
    .innerJoin(
      organizations,
      eq(orgInviteLinks.organizationId, organizations.id),
    )
    .leftJoin(members, eq(orgInviteLinks.createdByMemberId, members.id))
    .where(eq(orgInviteLinks.token, token))
    .limit(1);

  if (!row) return "unknown";
  if (row.revokedAt) return "revoked";
  if (row.expiresAt.getTime() < Date.now()) return "expired";

  return {
    organization: { id: row.organizationId, name: row.name, slug: row.slug },
    role: row.role,
    createdByUserId: row.createdByUserId,
  };
}

export interface LinkClaim {
  /** Already in the workspace — nothing to accept, just go there. */
  alreadyMember: boolean;
  invitationId: string | null;
  slug: string;
}

/**
 * Turn a link into an ordinary invitation addressed to whoever followed it.
 *
 * Joining then runs through better-auth's own accept flow, which is the only
 * thing in this codebase that creates a member — so a link cannot drift from
 * how an emailed invitation behaves, and there is no second path to get the
 * session's active workspace wrong.
 */
export async function claimInviteLink(args: {
  token: string;
  userId: string;
  email: string;
}): Promise<LinkClaim | LinkRefusal> {
  const resolved = await resolveInviteLink(args.token);
  if (typeof resolved === "string") return resolved;

  const existing = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, resolved.organization.id),
      eq(members.userId, args.userId),
    ),
  });
  if (existing) {
    return {
      alreadyMember: true,
      invitationId: null,
      slug: resolved.organization.slug,
    };
  }

  /** Falls back to an owner when whoever made the link has since been removed. */
  const inviterId =
    resolved.createdByUserId ?? (await anyOwner(resolved.organization.id));
  if (!inviterId) return "unknown";

  const [invitation] = await db
    .insert(invitations)
    .values({
      organizationId: resolved.organization.id,
      email: args.email,
      role: resolved.role,
      status: "pending",
      expiresAt: expiry(),
      inviterId,
    })
    .returning({ id: invitations.id });

  if (!invitation) throw new Error("Could not open an invitation.");

  return {
    alreadyMember: false,
    invitationId: invitation.id,
    slug: resolved.organization.slug,
  };
}

async function anyOwner(organizationId: string): Promise<string | null> {
  const owner = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.role, "owner"),
    ),
  });
  return owner?.userId ?? null;
}
