import {
  index,
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

    name: text("name").notNull(),
    slug: text("slug").notNull(),

    repoOwner: text("repo_owner"),
    repoName: text("repo_name"),
    repoUrl: text("repo_url"),
    repoPath: text("repo_path"),

    addedByMemberId: uuid("added_by_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),

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
