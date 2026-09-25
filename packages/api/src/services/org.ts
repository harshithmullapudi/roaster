import {
  db,
  invitations,
  members,
  organizations,
  type SelectMember,
  type SelectOrganization,
} from "@roster/db";
import { and, eq, sql } from "drizzle-orm";

export interface OrgAccess {
  organization: SelectOrganization;
  member: SelectMember;
}

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

export async function listInvitationsForUser(args: {
  userId: string;
  email: string;
}) {
  const rows = await db.query.invitations.findMany({
    where: and(
      eq(invitations.status, "pending"),
      sql`lower(${invitations.email}) = ${args.email.toLowerCase()}`,
    ),
    with: { organization: true, inviter: true },
    orderBy: invitations.createdAt,
  });
  if (rows.length === 0) return [];

  const memberships = await db.query.members.findMany({
    where: eq(members.userId, args.userId),
    columns: { organizationId: true },
  });
  const alreadyJoined = new Set(memberships.map((row) => row.organizationId));

  const now = Date.now();
  return rows
    .filter(
      (row) =>
        row.expiresAt.getTime() > now && !alreadyJoined.has(row.organizationId),
    )
    .map((row) => ({
      id: row.id,
      role: row.role,
      expiresAt: row.expiresAt,
      organization: {
        id: row.organization.id,
        name: row.organization.name,
        slug: row.organization.slug,
      },
      inviterName: row.inviter.name || row.inviter.email,
    }));
}

export type UserInvitation = Awaited<
  ReturnType<typeof listInvitationsForUser>
>[number];

export async function listUserOrganizations(userId: string) {
  const rows = await db.query.members.findMany({
    where: eq(members.userId, userId),
    with: { organization: true },
  });
  return rows.map((row) => ({ ...row.organization, role: row.role }));
}

export async function listOrgMembers(organizationId: string) {
  const rows = await db.query.members.findMany({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.type, "human"),
    ),
    with: { user: true },
    orderBy: members.createdAt,
  });

  /*
   * A human always has a user account; the column is only nullable because
   * agents share this table and have none. Anything without one is not a
   * person and has no place in a list of people.
   */
  return rows.flatMap((row) =>
    row.userId && row.user
      ? [
          {
            id: row.id,
            role: row.role,
            joinedAt: row.createdAt,
            userId: row.userId,
            name: row.user.name,
            email: row.user.email,
            image: row.user.image,
            agentName: row.agentName,
            supersetConnected: Boolean(row.supersetConnectedAt),
          },
        ]
      : [],
  );
}

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
