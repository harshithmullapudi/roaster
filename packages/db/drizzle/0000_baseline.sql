CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "roster";
--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"agent_name" text,
	"superset_key_encrypted" text,
	"superset_org_id" uuid,
	"superset_connected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "auth"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roster"."channel_stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster"."delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_thread_id" uuid NOT NULL,
	"origin_channel_id" uuid NOT NULL,
	"target_channel_id" uuid NOT NULL,
	"child_thread_id" uuid,
	"task" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"depth" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roster"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"author_member_id" uuid,
	"kind" text DEFAULT 'user' NOT NULL,
	"agent_channel_id" uuid,
	"body" jsonb NOT NULL,
	"text" text NOT NULL,
	"client_id" text,
	"parent_message_id" uuid,
	"thread_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roster"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"superset_project_id" text NOT NULL,
	"superset_host_id" text NOT NULL,
	"superset_org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"repo_owner" text,
	"repo_name" text,
	"repo_url" text,
	"repo_path" text,
	"added_by_member_id" uuid NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"watch_enabled" boolean DEFAULT true NOT NULL,
	"watch_paused_at" timestamp with time zone,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" jsonb,
	"description_text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roster"."thread_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text DEFAULT 'main' NOT NULL,
	"run_as_member_id" uuid,
	"superset_workspace_id" text,
	"superset_terminal_id" text,
	"superset_host_key" text,
	"status" text DEFAULT 'starting' NOT NULL,
	"last_progress" text,
	"transcript_offset" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"workspace_reaped_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster"."threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"root_message_id" uuid NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."api_keys" ADD CONSTRAINT "api_keys_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."channel_stars" ADD CONSTRAINT "channel_stars_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."channel_stars" ADD CONSTRAINT "channel_stars_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_parent_thread_id_threads_id_fk" FOREIGN KEY ("parent_thread_id") REFERENCES "roster"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_origin_channel_id_projects_id_fk" FOREIGN KEY ("origin_channel_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_target_channel_id_projects_id_fk" FOREIGN KEY ("target_channel_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."delegations" ADD CONSTRAINT "delegations_child_thread_id_threads_id_fk" FOREIGN KEY ("child_thread_id") REFERENCES "roster"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."messages" ADD CONSTRAINT "messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."messages" ADD CONSTRAINT "messages_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."messages" ADD CONSTRAINT "messages_agent_channel_id_projects_id_fk" FOREIGN KEY ("agent_channel_id") REFERENCES "roster"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."projects" ADD CONSTRAINT "projects_added_by_member_id_members_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "auth"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."tasks" ADD CONSTRAINT "tasks_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."thread_sessions" ADD CONSTRAINT "thread_sessions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "roster"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."thread_sessions" ADD CONSTRAINT "thread_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."thread_sessions" ADD CONSTRAINT "thread_sessions_run_as_member_id_members_id_fk" FOREIGN KEY ("run_as_member_id") REFERENCES "auth"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."threads" ADD CONSTRAINT "threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster"."threads" ADD CONSTRAINT "threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "roster"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitations_organization_id_idx" ON "auth"."invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "auth"."invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "members_organization_id_idx" ON "auth"."members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "members_user_id_idx" ON "auth"."members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_user_idx" ON "auth"."members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_agent_name_idx" ON "auth"."members" USING btree ("organization_id","agent_name");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "auth"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "auth"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_idx" ON "roster"."api_keys" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "api_keys_member_id_idx" ON "roster"."api_keys" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_stars_member_project_idx" ON "roster"."channel_stars" USING btree ("member_id","project_id");--> statement-breakpoint
CREATE INDEX "channel_stars_member_id_idx" ON "roster"."channel_stars" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delegations_one_open_per_parent_idx" ON "roster"."delegations" USING btree ("parent_thread_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "delegations_child_thread_idx" ON "roster"."delegations" USING btree ("child_thread_id");--> statement-breakpoint
CREATE INDEX "delegations_target_idx" ON "roster"."delegations" USING btree ("target_channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_project_seq_idx" ON "roster"."messages" USING btree ("project_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_project_client_id_idx" ON "roster"."messages" USING btree ("project_id","client_id");--> statement-breakpoint
CREATE INDEX "messages_project_created_idx" ON "roster"."messages" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_parent_idx" ON "roster"."messages" USING btree ("parent_message_id");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "roster"."messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "roster"."projects" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_superset_id_idx" ON "roster"."projects" USING btree ("organization_id","superset_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_idx" ON "roster"."projects" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "tasks_organization_created_idx" ON "roster"."tasks" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_project_created_idx" ON "roster"."tasks" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_organization_status_idx" ON "roster"."tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_sessions_thread_project_idx" ON "roster"."thread_sessions" USING btree ("thread_id","project_id");--> statement-breakpoint
CREATE INDEX "thread_sessions_thread_idx" ON "roster"."thread_sessions" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "thread_sessions_status_idx" ON "roster"."thread_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_root_message_idx" ON "roster"."threads" USING btree ("root_message_id");--> statement-breakpoint
CREATE INDEX "threads_project_idx" ON "roster"."threads" USING btree ("project_id");