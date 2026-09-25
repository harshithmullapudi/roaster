ALTER TABLE "roster"."delegations" DROP CONSTRAINT "delegations_origin_channel_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "roster"."delegations" DROP CONSTRAINT "delegations_target_channel_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "roster"."delegations" DROP COLUMN "origin_channel_id";--> statement-breakpoint
ALTER TABLE "roster"."delegations" DROP COLUMN "target_channel_id";