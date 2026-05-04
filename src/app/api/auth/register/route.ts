import { NextResponse, type NextRequest } from "next/server";

import {
  attachRefreshCookie,
  callBackend,
  forwardError,
} from "@/lib/auth/proxy";
import type { AuthResponse, RegisterRequest } from "@/lib/api/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterRequest;
  const { status, data } = await callBackend<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (status !== 201 || !data) {
    return forwardError(
      status,
      (data as unknown as { detail?: string } | null)?.detail,
    );
  }

  // Strip refresh_token from the JSON response — it lives in a cookie now.
  const { refresh_token, ...publicResponse } = data;
  const response = NextResponse.json(publicResponse, { status: 201 });
  return attachRefreshCookie(response, refresh_token);
}
