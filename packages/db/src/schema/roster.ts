import {
  bigint,
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

    body: jsonb("body").notNull(),
    text: text("text").notNull(),

    clientId: text("client_id"),

    parentMessageId: uuid("parent_message_id"),

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
  ],
);

export type SelectMessage = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
