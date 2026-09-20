CREATE TABLE "roster"."thread_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"muted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"message_id" uuid,
	"type" text NOT NULL,
	"actor_member_id" uuid,
	"actor_channel_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster"."threads" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "roster"."thread_subscriptions" ADD CONSTRAINT "thread_subscriptions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "roster"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."thread_subscriptions" ADD CONSTRAINT "thread_subscriptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."notifications" ADD CONSTRAINT "notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."notifications" ADD CONSTRAINT "notifications_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "roster"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."notifications" ADD CONSTRAINT "notifications_actor_member_id_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."notifications" ADD CONSTRAINT "notifications_actor_channel_id_projects_id_fk" FOREIGN KEY ("actor_channel_id") REFERENCES "roster"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "thread_subscriptions_thread_member_idx" ON "roster"."thread_subscriptions" USING btree ("thread_id","member_id");--> statement-breakpoint
CREATE INDEX "thread_subscriptions_member_idx" ON "roster"."thread_subscriptions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "notifications_member_created_idx" ON "roster"."notifications" USING btree ("member_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_member_unread_idx" ON "roster"."notifications" USING btree ("member_id") WHERE read_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_member_message_idx" ON "roster"."notifications" USING btree ("member_id","message_id") WHERE message_id is not null;--> statement-breakpoint
UPDATE "roster"."threads" t SET "last_activity_at" = coalesce(
	(select max(m.created_at) from "roster"."messages" m where m.thread_id = t.id),
	(select mm.created_at from "roster"."messages" mm where mm.id = t.root_message_id),
	now()
);--> statement-breakpoint
CREATE INDEX "threads_project_activity_idx" ON "roster"."threads" USING btree ("project_id","last_activity_at" DESC NULLS LAST);--> statement-breakpoint
INSERT INTO "roster"."thread_subscriptions" ("thread_id", "member_id", "reason", "last_read_at")
SELECT DISTINCT m.thread_id, m.author_member_id, 'replied', now()
FROM "roster"."messages" m
WHERE m.thread_id is not null
	AND m.author_member_id is not null
	AND m.deleted_at is null
	AND EXISTS (select 1 from "roster"."threads" t where t.id = m.thread_id)
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "roster"."thread_subscriptions" s SET "reason" = 'author'
FROM "roster"."threads" t
JOIN "roster"."messages" rm ON rm.id = t.root_message_id
WHERE s.thread_id = t.id AND s.member_id = rm.author_member_id;
