import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { members, organizations } from "./auth";

export const rosterSchema = pgSchema("roster");

export const projects = rosterSchema.table(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    supersetProjectId: text("superset_project_id").notNull(),
    supersetHostId: text("superset_host_id").notNull(),
    supersetOrgId: uuid("superset_org_id").notNull(),

    name: text("name").notNull(),
    slug: text("slug").notNull(),

    repoOwner: text("repo_owner"),
    repoName: text("repo_name"),
    repoUrl: text("repo_url"),
    repoPath: text("repo_path"),

    addedByMemberId: uuid("added_by_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    visibility: text("visibility").default("public").notNull(),

    watchEnabled: boolean("watch_enabled").default(true).notNull(),
    watchPausedAt: timestamp("watch_paused_at"),

    lastSeq: bigint("last_seq", { mode: "number" }).default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("projects_organization_id_idx").on(table.organizationId),
    uniqueIndex("projects_org_superset_id_idx").on(
      table.organizationId,
      table.supersetProjectId,
    ),
    uniqueIndex("projects_org_slug_idx").on(table.organizationId, table.slug),
  ],
);

export type SelectProject = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const channelStars = rosterSchema.table(
  "channel_stars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("channel_stars_member_project_idx").on(
      table.memberId,
      table.projectId,
    ),
    index("channel_stars_member_id_idx").on(table.memberId),
  ],
);

export type SelectChannelStar = typeof channelStars.$inferSelect;

export const messages = rosterSchema.table(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    seq: bigint("seq", { mode: "number" }).notNull(),

    authorMemberId: uuid("author_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    kind: text("kind").default("user").notNull(),

    /**
     * Which channel's agent spoke, for `kind: "agent"` rows. Agent messages
     * carry no `author_member_id`, so without this every agent looks like
     * every other one — and a delegated reply landing in another channel's
     * thread would be indistinguishable from that channel's own agent.
     */
    agentChannelId: uuid("agent_channel_id").references(() => projects.id, {
      onDelete: "set null",
    }),

    body: jsonb("body").notNull(),
    text: text("text").notNull(),

    clientId: text("client_id"),

    parentMessageId: uuid("parent_message_id"),

    threadId: uuid("thread_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    uniqueIndex("messages_project_seq_idx").on(table.projectId, table.seq),
    uniqueIndex("messages_project_client_id_idx").on(
      table.projectId,
      table.clientId,
    ),
    index("messages_project_created_idx").on(table.projectId, table.createdAt),
    index("messages_parent_idx").on(table.parentMessageId),
    index("messages_thread_idx").on(table.threadId),
  ],
);

export type SelectMessage = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const threads = rosterSchema.table(
  "threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    rootMessageId: uuid("root_message_id").notNull(),

    supersetWorkspaceId: text("superset_workspace_id"),
    supersetTerminalId: text("superset_terminal_id"),
    supersetHostKey: text("superset_host_key"),

    status: text("status").default("starting").notNull(),

    lastProgress: text("last_progress"),
    transcriptOffset: bigint("transcript_offset", { mode: "number" })
      .default(0)
      .notNull(),

    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    workspaceReapedAt: timestamp("workspace_reaped_at"),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("threads_root_message_idx").on(table.rootMessageId),
    index("threads_project_started_idx").on(table.projectId, table.startedAt),
    index("threads_status_idx").on(table.status),
  ],
);

export type SelectThread = typeof threads.$inferSelect;
export type InsertThread = typeof threads.$inferInsert;

export const tasks = rosterSchema.table(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    description: jsonb("description"),
    descriptionText: text("description_text").default("").notNull(),

    status: text("status").default("todo").notNull(),

    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("tasks_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("tasks_project_created_idx").on(table.projectId, table.createdAt),
    index("tasks_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export type SelectTask = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Credentials for the `roster` CLI, which agents run on a teammate's machine.
 *
 * Only the hash is stored — a key is shown once, at creation. Reads made with
 * a key carry the authority of the member who created it, so an agent can
 * never see a channel its operator could not open by hand.
 */
export const apiKeys = rosterSchema.table(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /** Leading characters, kept so a key is recognisable in settings. */
    prefix: text("prefix").notNull(),
    hash: text("hash").notNull(),

    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("api_keys_hash_idx").on(table.hash),
    index("api_keys_member_id_idx").on(table.memberId),
  ],
);

export type SelectApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * One agent handing work to another. The asking thread parks in `waiting`
 * until this row is answered, then wakes with the reply — so a delegation is
 * also the record of why a parked thread should ever resume.
 */
export const delegations = rosterSchema.table(
  "delegations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** The thread that asked, and is now parked. */
    parentThreadId: uuid("parent_thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    /** The asking thread's channel — what the answering agent may read. */
    originChannelId: uuid("origin_channel_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** The channel whose agent was asked. */
    targetChannelId: uuid("target_channel_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Null until the answering session has been created. */
    childThreadId: uuid("child_thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),

    task: text("task").notNull(),
    status: text("status").default("open").notNull(),

    /** Guards against fern-core → ash-spark → fern-core running forever. */
    depth: bigint("depth", { mode: "number" }).default(1).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    answeredAt: timestamp("answered_at"),
  },
  (table) => [
    /** A thread may only wait on one answer at a time. */
    uniqueIndex("delegations_one_open_per_parent_idx")
      .on(table.parentThreadId)
      .where(sql`status = 'open'`),
    index("delegations_child_thread_idx").on(table.childThreadId),
    index("delegations_target_idx").on(table.targetChannelId),
  ],
);

export type SelectDelegation = typeof delegations.$inferSelect;
export type InsertDelegation = typeof delegations.$inferInsert;
