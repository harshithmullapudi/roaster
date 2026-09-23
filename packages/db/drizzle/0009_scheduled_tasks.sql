CREATE TABLE "roster"."scheduled_task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_task_id" uuid NOT NULL,
	"slot_at" timestamp with time zone NOT NULL,
	"task_id" uuid,
	"outcome" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster"."scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"rrule" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"next_run_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_reason" text,
	"run_as_member_id" uuid,
	"created_by_member_id" uuid,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster"."scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_scheduled_task_id_scheduled_tasks_id_fk" FOREIGN KEY ("scheduled_task_id") REFERENCES "roster"."scheduled_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "roster"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_run_as_member_id_members_id_fk" FOREIGN KEY ("run_as_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_task_runs_slot_idx" ON "roster"."scheduled_task_runs" USING btree ("scheduled_task_id","slot_at");--> statement-breakpoint
CREATE INDEX "scheduled_task_runs_recent_idx" ON "roster"."scheduled_task_runs" USING btree ("scheduled_task_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scheduled_tasks_due_idx" ON "roster"."scheduled_tasks" USING btree ("next_run_at") WHERE enabled and next_run_at is not null;--> statement-breakpoint
CREATE INDEX "scheduled_tasks_project_idx" ON "roster"."scheduled_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scheduled_tasks_organization_idx" ON "roster"."scheduled_tasks" USING btree ("organization_id");