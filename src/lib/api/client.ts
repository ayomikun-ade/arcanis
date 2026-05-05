/**
 * API client for direct WhisperBox calls (everything except auth).
 *
 * Auth endpoints (register / login / refresh / logout) go through the
 * Next.js proxy at /api/auth/* — that's where we manage the httpOnly
 * refresh-token cookie. See src/lib/auth/proxy.ts for those.
 *
 * The client *owns* its access token (a private instance field). The
 * AuthProvider pushes new values via `setAccessToken()` after register /
 * login / unlock, and `refresh()` rotates it in-band on 401. This keeps
 * the React layer free of refs that flow into the constructor — which
 * React 19 flags as ref-during-render even when the read is delayed.
 *
 * Request interceptor:  attach `Authorization: Bearer <token>` from the
 *                       internal token (read on every call so rotations
 *                       land immediately).
 * Response interceptor: on 401, run a single-flight refresh and retry the
 *                       original request once. Concurrent 401s share one
 *                       in-flight refresh promise.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/lib/env";

import type {
  ConversationSummary,
  MessageResponse,
  PublicKeyResponse,
  SendMessageRequest,
  UserSummary,
} from "./types";

/** Internal flag we attach to retried requests so we never loop forever. */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | undefined;

  constructor(status: number, detail?: string) {
    super(detail ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  static fromAxios(error: AxiosError): ApiError {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    let detail: string | undefined;
    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail: unknown }).detail === "string"
    ) {
      detail = (data as { detail: string }).detail;
    }
    return new ApiError(status, detail ?? error.message);
  }
}

export class ApiClient {
  private readonly http: AxiosInstance;
  private accessToken: string | null = null;
  private refreshing: Promise<string | null> | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: env.apiBaseUrl,
      headers: { "Content-Type": "application/json" },
    });

    this.http.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as RetriableConfig | undefined;
        const status = error.response?.status;
        if (status !== 401 || !config || config._retried) {
          return Promise.reject(ApiError.fromAxios(error));
        }

        const newToken = await this.singleFlightRefresh();
        if (!newToken) return Promise.reject(ApiError.fromAxios(error));

        config._retried = true;
        config.headers.Authorization = `Bearer ${newToken}`;
        return this.http.request(config);
      },
    );
  }

  /** Push a new access token (after register / login / unlock). */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** Read the current in-memory access token. Used by WsConnection at handshake time. */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Hit /api/auth/refresh, store the new token, and return it. Returns null
   * if the refresh-token cookie is also dead. Single-flight: concurrent
   * callers share one in-flight refresh promise.
   */
  refresh(): Promise<string | null> {
    return this.singleFlightRefresh();
  }

  private singleFlightRefresh(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const res = await fetch("/api/auth/refresh", { method: "POST" });
          if (!res.ok) {
            this.accessToken = null;
            return null;
          }
          const body = (await res.json()) as { access_token: string };
          this.accessToken = body.access_token;
          return body.access_token;
        } catch {
          this.accessToken = null;
          return null;
        }
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  /* ────────── Endpoints ────────── */

  async searchUsers(q: string): Promise<UserSummary[]> {
    const { data } = await this.http.get<UserSummary[]>("/users/search", {
      params: { q },
    });
    return data;
  }

  async getPublicKey(userId: string): Promise<PublicKeyResponse> {
    const { data } = await this.http.get<PublicKeyResponse>(
      `/users/${encodeURIComponent(userId)}/public-key`,
    );
    return data;
  }

  async getConversations(): Promise<ConversationSummary[]> {
    const { data } =
      await this.http.get<ConversationSummary[]>("/conversations");
    return data;
  }

  async getMessages(
    userId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<MessageResponse[]> {
    const { data } = await this.http.get<MessageResponse[]>(
      `/conversations/${encodeURIComponent(userId)}/messages`,
      { params: opts },
    );
    return data;
  }

  async sendMessage(req: SendMessageRequest): Promise<MessageResponse> {
    const { data } = await this.http.post<MessageResponse>("/messages", req);
    return data;
  }
}
