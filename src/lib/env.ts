/**
 * Typed env access. Throws at module load if a required value is missing,
 * so misconfiguration surfaces immediately rather than at request time.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example → .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  apiBaseUrl: required(
    "NEXT_PUBLIC_API_BASE_URL",
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ),
} as const;

/** Server-only env. Never reference from client code. */
export const serverEnv = {
  cookieSecure: process.env.COOKIE_SECURE === "true",
} as const;

/** Derive the WebSocket URL from the API base URL (http→ws, https→wss). */
export function wsUrl(path: string, token: string): string {
  const url = new URL(path, env.apiBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}
