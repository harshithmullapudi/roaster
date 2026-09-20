import {
  inviteLink,
  refreshInviteLink,
  revokeInviteLink,
} from "../services/invite-links";
import { capabilityProcedure, createTRPCRouter } from "../trpc";

const inviteProcedure = capabilityProcedure("member:invite");

export const inviteLinksRouter = createTRPCRouter({
  get: inviteProcedure.query(({ ctx }) => inviteLink(ctx.organizationId)),

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
