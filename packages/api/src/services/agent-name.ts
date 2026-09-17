import { db, members } from "@roster/db";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";

const TAKEN = "That name is taken in this workspace. Pick another.";

export function normalizeAgentName(agentName: string): string {
  return agentName.trim().toLowerCase();
}

export async function isAgentNameTaken(args: {
  organizationId: string;
  memberId: string;
  agentName: string;
}): Promise<boolean> {
  const clash = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, args.organizationId),
      ne(members.id, args.memberId),
      eq(members.agentName, normalizeAgentName(args.agentName)),
    ),
    columns: { id: true },
  });
  return Boolean(clash);
}

export async function setAgentName(args: {
  organizationId: string;
  memberId: string;
  agentName: string;
}): Promise<string> {
  const agentName = normalizeAgentName(args.agentName);

  if (await isAgentNameTaken({ ...args, agentName })) {
    throw new TRPCError({ code: "CONFLICT", message: TAKEN });
  }

  try {
    await db
      .update(members)
      .set({ agentName })
      .where(eq(members.id, args.memberId));
  } catch (cause) {
    if (
      cause instanceof Error &&
      cause.message.includes("members_org_agent_name_idx")
    ) {
      throw new TRPCError({ code: "CONFLICT", message: TAKEN });
    }
    throw cause;
  }

  return agentName;
}
