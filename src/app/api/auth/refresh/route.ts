import { NextResponse } from "next/server";

import {
  attachRefreshCookie,
  callBackend,
  clearRefreshCookie,
  forwardError,
  readRefreshToken,
} from "@/lib/auth/proxy";
import type { AuthResponse, RefreshResponse } from "@/lib/api/types";

export async function POST() {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return forwardError(401, "No refresh token");
  }

  const { status, data } = await callBackend<RefreshResponse | AuthResponse>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );

  if (status !== 200 || !data) {
    // Refresh failed → cookie is dead, kill it so the client falls back to login.
    return clearRefreshCookie(forwardError(status || 401));
  }

  // The spec says /auth/refresh returns only access_token, but if the backend
  // ever rotates the refresh token (RFC 6749 best practice), pick that up too.
  const rotatedRefresh =
    "refresh_token" in data && typeof data.refresh_token === "string"
      ? data.refresh_token
      : null;

  const response = NextResponse.json(
    {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    },
    { status: 200 },
  );
  if (rotatedRefresh) attachRefreshCookie(response, rotatedRefresh);
  return response;
}
