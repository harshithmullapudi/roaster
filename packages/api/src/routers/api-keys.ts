import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { listApiKeys, mintApiKey, revokeApiKey } from "../services/api-keys";
import { createTRPCRouter, memberProcedure } from "../trpc";

export const apiKeysRouter = createTRPCRouter({
  list: memberProcedure.query(({ ctx }) => listApiKeys(ctx.member.id)),

  create: memberProcedure
    .input(z.object({ name: z.string().trim().min(1).max(60) }))
    .mutation(({ ctx, input }) =>
      mintApiKey({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        name: input.name,
      }),
    ),

  revoke: memberProcedure
    .input(z.object({ keyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const revoked = await revokeApiKey({
        memberId: ctx.member.id,
        keyId: input.keyId,
      });
      if (!revoked) throw new TRPCError({ code: "NOT_FOUND" });
      return { revoked: true };
    }),
});
