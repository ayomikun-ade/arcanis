/**
 * Server-side helpers shared by every /api/auth/* route handler.
 *
 * The refresh token lives in an httpOnly cookie that only this proxy can
 * read. The browser-side code never sees it. The access token is *not*
 * persisted by us — it's returned to the client in the JSON response and
 * held in JS memory only (lost on tab close → triggers refresh on next
 * load via the cookie, or full re-login if that's expired too).
 */

import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env, serverEnv } from "@/lib/env";

export const REFRESH_COOKIE = "arcanis_rt";

/** 30 days. Whisperbox docs don't state refresh-token TTL — long enough for anyone. */
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const COOKIE_OPTIONS_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/api/auth",
};

/** Read the refresh token from the incoming request. */
export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/** Apply Set-Cookie to a response, storing the refresh token. */
export function attachRefreshCookie(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set({
    ...COOKIE_OPTIONS_BASE,
    name: REFRESH_COOKIE,
    value: token,
    secure: serverEnv.cookieSecure,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
  return response;
}

/** Apply Set-Cookie that clears the refresh token. */
export function clearRefreshCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    ...COOKIE_OPTIONS_BASE,
    name: REFRESH_COOKIE,
    value: "",
    secure: serverEnv.cookieSecure,
    maxAge: 0,
  });
  return response;
}

/**
 * Forward a request to the WhisperBox backend and return the parsed body
 * along with the upstream status. Auth route handlers wrap this with
 * cookie management and the public response shape.
 */
export async function callBackend<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
): Promise<{ status: number; data: T | null }> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    // Non-JSON body (e.g. 204). Leave data null.
  }
  return { status: response.status, data };
}

/** Forward a JSON error from upstream as-is. */
export function forwardError(
  status: number,
  detail?: unknown,
): NextResponse<{ detail: string }> {
  const message =
    typeof detail === "string"
      ? detail
      : (status === 401 && "Unauthorized") ||
        (status === 404 && "Not found") ||
        "Request failed";
  return NextResponse.json({ detail: message }, { status });
}
