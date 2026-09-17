import { z } from "zod";

import { isAgentNameTaken, setAgentName } from "../services/agent-name";
import { saveProjects } from "../services/superset-connection";
import { createTRPCRouter, memberProcedure } from "../trpc";

const agentNameSchema = z
  .string()
  .trim()
  .min(2, "Give your agent a name.")
  .max(24, "Keep it under 24 characters.")
  .regex(
    /^[a-zA-Z][a-zA-Z0-9-]*$/,
    "Letters, numbers and hyphens, starting with a letter.",
  );

const selectedProjectSchema = z.object({
  supersetProjectId: z.string().min(1),
  supersetHostId: z.string().min(1),
  name: z.string().min(1),
  repoOwner: z.string().nullable(),
  repoName: z.string().nullable(),
  repoUrl: z.string().nullable(),
  repoPath: z.string().nullable(),
});

export const onboardingRouter = createTRPCRouter({
  selectProjects: memberProcedure
    .input(z.object({ projects: z.array(selectedProjectSchema).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const added = await saveProjects({
        organizationId: ctx.organizationId,
        member: ctx.member,
        selected: input.projects,
      });
      return { added };
    }),

  checkAgentName: memberProcedure
    .input(z.object({ agentName: agentNameSchema }))
    .query(async ({ ctx, input }) => {
      const taken = await isAgentNameTaken({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        agentName: input.agentName,
      });
      return { available: !taken };
    }),

  setAgentName: memberProcedure
    .input(z.object({ agentName: agentNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const agentName = await setAgentName({
        organizationId: ctx.organizationId,
        memberId: ctx.member.id,
        agentName: input.agentName,
      });
      return { agentName };
    }),
});
