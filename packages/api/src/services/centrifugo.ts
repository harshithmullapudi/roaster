import { expiresIn, signHs256 } from "../utils/jwt";

const CONNECTION_TOKEN_TTL_SECONDS = 60 * 30;
const SUBSCRIPTION_TOKEN_TTL_SECONDS = 60 * 30;
const PUBLISH_TIMEOUT_MS = 2000;

function trimmed(value: string | undefined): string | null {
  return value && value.length > 0 ? value.replace(/\/+$/, "") : null;
}

function apiUrl(): string | null {
  return trimmed(process.env.CENTRIFUGO_URL);
}

function publicUrl(): string | null {
  return trimmed(process.env.CENTRIFUGO_PUBLIC_URL) ?? apiUrl();
}

function apiKey(): string | null {
  const key = process.env.CENTRIFUGO_API_KEY;
  return key && key.length > 0 ? key : null;
}

function secret(): string | null {
  const value = process.env.CENTRIFUGO_TOKEN_HMAC_SECRET;
  return value && value.length > 0 ? value : null;
}

export function isEnabled(): boolean {
  return Boolean(apiUrl() && secret());
}

export function websocketUrl(): string | null {
  const url = publicUrl();
  if (!url) return null;
  return `${url.replace(/^http/, "ws")}/connection/websocket`;
}

export function channelName(projectId: string): string {
  return `channel:${projectId}`;
}

export function threadChannelName(threadId: string): string {
  return `thread:${threadId}`;
}

export function userChannelName(userId: string): string {
  return `user:${userId}`;
}

export async function publish(
  channel: string,
  data: unknown,
): Promise<boolean> {
  const url = apiUrl();
  const key = apiKey();
  if (!url || !key) return false;

  try {
    const response = await fetch(`${url}/api/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
      },
      body: JSON.stringify({ channel, data }),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[centrifugo] publish to ${channel} failed with ${response.status}`,
      );
      return false;
    }

    const payload = (await response.json()) as {
      error?: { code?: number; message?: string };
    };
    if (payload.error) {
      console.warn(
        `[centrifugo] publish to ${channel} rejected: ${payload.error.message ?? "unknown"}`,
      );
      return false;
    }

    return true;
  } catch (cause) {
    console.warn(
      `[centrifugo] publish to ${channel} unavailable: ${
        cause instanceof Error ? cause.message : "unknown error"
      }`,
    );
    return false;
  }
}

export function connectionToken(userId: string): string | null {
  const value = secret();
  if (!value) return null;
  return signHs256(
    { sub: userId, exp: expiresIn(CONNECTION_TOKEN_TTL_SECONDS) },
    value,
  );
}

export function subscriptionToken(
  userId: string,
  channel: string,
): string | null {
  const value = secret();
  if (!value) return null;
  return signHs256(
    {
      sub: userId,
      channel,
      exp: expiresIn(SUBSCRIPTION_TOKEN_TTL_SECONDS),
    },
    value,
  );
}
