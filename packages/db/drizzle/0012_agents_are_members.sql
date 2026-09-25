ALTER TABLE "auth"."members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD COLUMN "type" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD COLUMN "brief" text;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_project_idx" ON "auth"."members" USING btree ("project_id");--> statement-breakpoint

-- Every channel that exists gets the agent it has always had, under the handle
-- it has always answered to: the adder's agent name joined to the channel slug.
-- Where a person already holds that name the channel's agent takes a
-- disambiguated one, so the migration cannot fail on the unique index.
INSERT INTO "auth"."members"
  ("organization_id", "user_id", "role", "type", "agent_name", "project_id", "created_at")
SELECT
  p."organization_id",
  NULL,
  'member',
  'agent',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "auth"."members" taken
       WHERE taken."organization_id" = p."organization_id"
         AND lower(taken."agent_name") = base."handle"
    )
    THEN base."handle" || '-' || left(replace(p."id"::text, '-', ''), 4)
    ELSE base."handle"
  END,
  p."id",
  now()
FROM "roster"."projects" p
LEFT JOIN "auth"."members" owner ON owner."id" = p."added_by_member_id"
CROSS JOIN LATERAL (
  SELECT lower(coalesce(nullif(trim(owner."agent_name"), ''), 'agent'))
         || '-' || p."slug" AS "handle"
) base;--> statement-breakpoint

-- Messages an agent wrote were authorless, with identity recovered through the
-- channel. The agent is a member now, so it can simply be the author.
UPDATE "roster"."messages" m
   SET "author_member_id" = a."id"
  FROM "auth"."members" a
 WHERE a."project_id" = m."agent_channel_id"
   AND a."type" = 'agent'
   AND m."agent_channel_id" IS NOT NULL
   AND m."author_member_id" IS NULL;--> statement-breakpoint

-- Messages older than that column have no channel recorded on them at all. An
-- agent message belongs to the channel it was posted in, so that is who wrote
-- it. Without this the whole of an old transcript reads as an unnamed "Agent".
UPDATE "roster"."messages" m
   SET "author_member_id" = a."id"
  FROM "auth"."members" a
 WHERE a."project_id" = m."project_id"
   AND a."type" = 'agent'
   AND m."kind" IN ('agent', 'delegation')
   AND m."agent_channel_id" IS NULL
   AND m."author_member_id" IS NULL;--> statement-breakpoint

ALTER TABLE "roster"."thread_sessions" ADD COLUMN "agent_member_id" uuid;--> statement-breakpoint
UPDATE "roster"."thread_sessions" ts
   SET "agent_member_id" = a."id"
  FROM "auth"."members" a
 WHERE a."project_id" = ts."project_id"
   AND a."type" = 'agent';--> statement-breakpoint
ALTER TABLE "roster"."thread_sessions" ALTER COLUMN "agent_member_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "roster"."thread_sessions" ADD CONSTRAINT "thread_sessions_agent_member_id_members_id_fk" FOREIGN KEY ("agent_member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "roster"."thread_sessions_thread_project_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "thread_sessions_thread_agent_idx" ON "roster"."thread_sessions" USING btree ("thread_id","agent_member_id");--> statement-breakpoint

ALTER TABLE "roster"."delegations" ADD COLUMN "origin_member_id" uuid;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD COLUMN "target_member_id" uuid;--> statement-breakpoint
UPDATE "roster"."delegations" d
   SET "origin_member_id" = origin."id",
       "target_member_id" = target."id"
  FROM "auth"."members" origin, "auth"."members" target
 WHERE origin."project_id" = d."origin_channel_id"
   AND origin."type" = 'agent'
   AND target."project_id" = d."target_channel_id"
   AND target."type" = 'agent';--> statement-breakpoint
ALTER TABLE "roster"."delegations" ALTER COLUMN "origin_member_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ALTER COLUMN "target_member_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_origin_member_id_members_id_fk" FOREIGN KEY ("origin_member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_target_member_id_members_id_fk" FOREIGN KEY ("target_member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "roster"."delegations_target_idx";--> statement-breakpoint
CREATE INDEX "delegations_target_idx" ON "roster"."delegations" USING btree ("target_member_id");
