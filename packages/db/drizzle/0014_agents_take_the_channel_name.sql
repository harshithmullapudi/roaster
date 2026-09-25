-- An agent is named for its channel, not for whoever connected the folder.
-- Channel slugs are already unique per organization, so the slug alone is a
-- unique handle; where a person or another agent already holds it, the agent
-- keeps a disambiguated one rather than the rename failing.
UPDATE "auth"."members" a
   SET "agent_name" = p."slug"
  FROM "roster"."projects" p
 WHERE p."id" = a."project_id"
   AND a."type" = 'agent'
   AND a."agent_name" <> p."slug"
   AND a."agent_name" LIKE '%-' || p."slug"
   AND NOT EXISTS (
     SELECT 1 FROM "auth"."members" taken
      WHERE taken."organization_id" = a."organization_id"
        AND lower(taken."agent_name") = lower(p."slug")
   );
