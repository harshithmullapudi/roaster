export interface SupersetClaims {
  sub: string;
  organizationIds: string[];
  exp: number;
}

export function decodeJwtClaims(token: string): SupersetClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Superset returned a token that is not a JWT.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(parts[1] as string, "base64url").toString("utf8"),
    );
  } catch {
    throw new Error("Superset returned a JWT with an unreadable payload.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Superset returned a JWT with an unreadable payload.");
  }

  const { sub, organizationIds, exp } = payload as Record<string, unknown>;

  if (typeof sub !== "string" || !sub) {
    throw new Error("Superset JWT is missing its subject.");
  }

  if (
    !Array.isArray(organizationIds) ||
    organizationIds.length === 0 ||
    !organizationIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    throw new Error(
      "Superset JWT carries no organizations. The key may have been revoked, " +
        "or the account may not belong to an organization yet.",
    );
  }

  return {
    sub,
    organizationIds: organizationIds as string[],
    exp: typeof exp === "number" ? exp : 0,
  };
}
