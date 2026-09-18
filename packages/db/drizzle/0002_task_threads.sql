ALTER TABLE "roster"."tasks" DROP CONSTRAINT "tasks_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "roster"."tasks" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD CONSTRAINT "tasks_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "roster"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_thread_idx" ON "roster"."tasks" USING btree ("thread_id");