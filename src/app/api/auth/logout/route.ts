import { NextResponse, type NextRequest } from "next/server";

import {
  callBackend,
  clearRefreshCookie,
  readRefreshToken,
} from "@/lib/auth/proxy";

export async function POST(request: NextRequest) {
  const refreshToken = await readRefreshToken();
  const accessToken = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");

  // Best-effort backend logout. We always clear our cookie regardless of
  // whether the upstream call succeeded — local sign-out is non-negotiable.
  if (refreshToken && accessToken) {
    await callBackend("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {
      /* swallow — we're logging out anyway */
    });
  }

  return clearRefreshCookie(
    NextResponse.json({ detail: "Logged out" }, { status: 200 }),
  );
}
