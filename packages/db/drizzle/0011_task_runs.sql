CREATE TABLE "roster"."task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"slot_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster"."task_runs" ADD CONSTRAINT "task_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "roster"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_runs_slot_idx" ON "roster"."task_runs" USING btree ("task_id","slot_at");--> statement-breakpoint
CREATE INDEX "task_runs_recent_idx" ON "roster"."task_runs" USING btree ("task_id","created_at" DESC NULLS LAST);