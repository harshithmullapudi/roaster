import {
  db,
  invitations,
  members,
  organizations,
  type SelectMember,
  type SelectOrganization,
} from "@roster/db";
import { and, eq } from "drizzle-orm";

export interface OrgAccess {
  organization: SelectOrganization;
  member: SelectMember;
}

/**
 * Resolves a URL slug to an organization the user is actually a member of.
 *
 * This is the only authorization check for team-scoped data, and it is
 * deliberately server-side and slug-driven: the client cannot pick its own
 * organization by sending a different id, and a stale
 * `session.activeOrganizationId` cannot widen access. Returns null for both
 * "no such team" and "not your team" so callers cannot use the distinction to
 * probe which slugs exist.
 */
export async function resolveOrgAccess(args: {
  userId: string;
  slug: string;
}): Promise<OrgAccess | null> {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.slug, args.slug),
  });
  if (!organization) return null;

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, organization.id),
      eq(members.userId, args.userId),
    ),
  });
  if (!member) return null;

  return { organization, member };
}

/**
 * Enough of an invitation to render its landing page, readable without a
 * session — the recipient has to see who invited them to what *before* they
 * sign in, and the unguessable id in the URL is the only secret involved.
 * Accepting it still goes through better-auth, which checks that the session's
 * email matches.
 */
export async function getInvitationPreview(invitationId: string) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
    with: { organization: true, inviter: true },
  });
  if (!invitation) return null;

  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    expired: invitation.expiresAt.getTime() < Date.now(),
    organization: {
      name: invitation.organization.name,
      slug: invitation.organization.slug,
    },
    inviterName: invitation.inviter.name || invitation.inviter.email,
  };
}

export type InvitationPreview = NonNullable<
  Awaited<ReturnType<typeof getInvitationPreview>>
>;

/** Every organization the user belongs to, for the team switcher. */
export async function listUserOrganizations(userId: string) {
  const rows = await db.query.members.findMany({
    where: eq(members.userId, userId),
    with: { organization: true },
  });
  return rows.map((row) => ({ ...row.organization, role: row.role }));
}

/** The members settings table. Callers must have passed `resolveOrgAccess`. */
export async function listOrgMembers(organizationId: string) {
  const rows = await db.query.members.findMany({
    where: eq(members.organizationId, organizationId),
    with: { user: true },
    orderBy: members.createdAt,
  });

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    joinedAt: row.createdAt,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    image: row.user.image,
  }));
}

/**
 * Invitations still awaiting a reply. Expired rows keep their `pending` status
 * until someone opens the link, so they are filtered out by date here rather
 * than by status — otherwise the settings page shows invitations that can
 * never be accepted.
 */
export async function listPendingInvitations(organizationId: string) {
  const rows = await db.query.invitations.findMany({
    where: and(
      eq(invitations.organizationId, organizationId),
      eq(invitations.status, "pending"),
    ),
    orderBy: invitations.createdAt,
  });

  const now = Date.now();
  return rows
    .filter((row) => row.expiresAt.getTime() > now)
    .map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }));
}
