import { NextResponse, type NextRequest } from "next/server";

import {
  attachRefreshCookie,
  callBackend,
  forwardError,
} from "@/lib/auth/proxy";
import type { AuthResponse, LoginRequest } from "@/lib/api/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginRequest;
  const { status, data } = await callBackend<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (status !== 200 || !data) {
    return forwardError(
      status,
      (data as unknown as { detail?: string } | null)?.detail,
    );
  }

  const { refresh_token, ...publicResponse } = data;
  const response = NextResponse.json(publicResponse, { status: 200 });
  return attachRefreshCookie(response, refresh_token);
}
