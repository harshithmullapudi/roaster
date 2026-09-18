CREATE TABLE "roster"."org_invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_by_member_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "roster"."org_invite_links" ADD CONSTRAINT "org_invite_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."org_invite_links" ADD CONSTRAINT "org_invite_links_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_invite_links_organization_idx" ON "roster"."org_invite_links" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invite_links_token_idx" ON "roster"."org_invite_links" USING btree ("token");