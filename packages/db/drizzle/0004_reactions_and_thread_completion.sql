CREATE TABLE "roster"."reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster"."threads" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roster"."threads" ADD COLUMN "completed_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "roster"."reactions" ADD CONSTRAINT "reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "roster"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."reactions" ADD CONSTRAINT "reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_message_member_emoji_idx" ON "roster"."reactions" USING btree ("message_id","member_id","emoji");--> statement-breakpoint
CREATE INDEX "reactions_message_idx" ON "roster"."reactions" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "roster"."threads" ADD CONSTRAINT "threads_completed_by_member_id_members_id_fk" FOREIGN KEY ("completed_by_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;