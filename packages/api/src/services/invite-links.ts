import { randomBytes } from "node:crypto";

import {
  db,
  invitations,
  members,
  organizations,
  orgInviteLinks,
} from "@roster/db";
import { and, eq } from "drizzle-orm";

export const INVITE_LINK_TTL_DAYS = 7;

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

export async function inviteLink(
  organizationId: string,
): Promise<InviteLink | null> {
  const row = await db.query.orgInviteLinks.findFirst({
    where: eq(orgInviteLinks.organizationId, organizationId),
  });

  if (!row || row.revokedAt) return null;
  return toLink(row);
}

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
  createdByUserId: string | null;
}

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
  alreadyMember: boolean;
  invitationId: string | null;
  slug: string;
}

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
