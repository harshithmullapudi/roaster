import {
  inviteLink,
  refreshInviteLink,
  revokeInviteLink,
} from "../services/invite-links";
import { capabilityProcedure, createTRPCRouter } from "../trpc";

/**
 * The workspace's join link. Gated on `member:invite` — handing out a link
 * that lets anyone in is the same authority as inviting them by name.
 */
const inviteProcedure = capabilityProcedure("member:invite");

export const inviteLinksRouter = createTRPCRouter({
  get: inviteProcedure.query(({ ctx }) => inviteLink(ctx.organizationId)),

  /** Creates the link, or replaces it — the old token stops working. */
  refresh: inviteProcedure.mutation(({ ctx }) =>
    refreshInviteLink({
      organizationId: ctx.organizationId,
      memberId: ctx.member.id,
    }),
  ),

  revoke: inviteProcedure.mutation(async ({ ctx }) => {
    await revokeInviteLink(ctx.organizationId);
    return { revoked: true };
  }),
});
