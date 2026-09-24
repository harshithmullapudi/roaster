ALTER TABLE "roster"."scheduled_task_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roster"."scheduled_tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "roster"."scheduled_task_runs" CASCADE;--> statement-breakpoint
DROP TABLE "roster"."scheduled_tasks" CASCADE;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD COLUMN "rrule" text;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD COLUMN "next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD COLUMN "recurrence_disabled_reason" text;--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "roster"."tasks" USING btree ("next_run_at") WHERE rrule is not null and next_run_at is not null;