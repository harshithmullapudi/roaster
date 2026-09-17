import SuperJSON from "superjson";

import { redact } from "./crypto";
import { decodeJwtClaims, type SupersetClaims } from "./jwt";

const API_URL = process.env.SUPERSET_API_URL ?? "https://api.superset.sh";
const RELAY_URL = process.env.SUPERSET_RELAY_URL ?? "https://relay.superset.sh";

const JWT_TTL_MS = 50 * 60 * 1000;

export class SupersetError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(redact(message));
    this.name = "SupersetError";
  }
}

export interface SupersetSession {
  jwt: string;
  claims: SupersetClaims;
}

export async function mintJwt(apiKey: string): Promise<SupersetSession> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/token`, {
      headers: { "x-api-key": apiKey },
    });
  } catch (cause) {
    throw new SupersetError(
      `Could not reach Superset at ${API_URL}. ${(cause as Error).message}`,
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SupersetError(
        "Superset rejected that key. Check it was copied whole from Settings → API keys.",
        response.status,
      );
    }
    throw new SupersetError(
      `Superset returned ${response.status} when exchanging the key.`,
      response.status,
    );
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new SupersetError("Superset returned no token for that key.");
  }

  return { jwt: body.token, claims: decodeJwtClaims(body.token) };
}

export function jwtExpiresAt(): Date {
  return new Date(Date.now() + JWT_TTL_MS);
}

async function unwrapTrpc<T>(response: Response, what: string): Promise<T> {
  const raw = await response.text();

  if (!response.ok) {
    throw new SupersetError(
      `${what} failed with ${response.status}: ${raw.slice(0, 200)}`,
      response.status,
    );
  }

  let parsed: { result?: { data?: unknown } };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SupersetError(`${what} returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  const data = parsed.result?.data;
  if (data === undefined || data === null) {
    throw new SupersetError(`${what} returned a malformed response.`);
  }

  if (typeof data === "object" && data !== null && "json" in data) {
    return SuperJSON.deserialize(
      data as Parameters<typeof SuperJSON.deserialize>[0],
    ) as T;
  }
  return data as T;
}

export interface SupersetOrganization {
  id: string;
  name: string;
  slug: string;
}

export async function getOrganization(
  jwt: string,
  organizationId: string,
): Promise<SupersetOrganization | null> {
  const input = encodeURIComponent(
    JSON.stringify(SuperJSON.serialize({ id: organizationId })),
  );
  const response = await fetch(
    `${API_URL}/api/trpc/organization.getByIdFromJwt?input=${input}`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  return unwrapTrpc<SupersetOrganization | null>(
    response,
    "Reading your Superset organization",
  );
}

export async function listOrganizations(
  jwt: string,
  organizationIds: string[],
): Promise<SupersetOrganization[]> {
  const results = await Promise.all(
    organizationIds.map((id) => getOrganization(jwt, id).catch(() => null)),
  );
  return results.filter((org): org is SupersetOrganization => org !== null);
}

export interface SupersetHost {
  id: string;
  name: string;
  online: boolean;
  wakeCommand: string | null;
  organizationId: string;
  platform: string | null;
}

export async function listHosts(
  jwt: string,
  organizationId: string,
): Promise<SupersetHost[]> {
  const input = encodeURIComponent(
    JSON.stringify(SuperJSON.serialize({ organizationId })),
  );
  const response = await fetch(`${API_URL}/api/trpc/host.list?input=${input}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return unwrapTrpc<SupersetHost[]>(response, "Listing your Superset machines");
}

export interface SupersetProject {
  id: string;
  name: string;
  repoPath: string;
  repoOwner: string | null;
  repoName: string | null;
  repoUrl: string | null;
}

export async function listProjects(
  jwt: string,
  organizationId: string,
  hostId: string,
): Promise<SupersetProject[]> {
  const routingKey = `${organizationId}:${hostId}`;
  const url = `${RELAY_URL}/hosts/${routingKey}/trpc/project.list`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  } catch (cause) {
    throw new SupersetError(
      `Could not reach that machine through the relay. ${(cause as Error).message}`,
    );
  }

  return unwrapTrpc<SupersetProject[]>(response, "Listing projects on that machine");
}
