/**
 * API client for direct WhisperBox calls (everything except auth).
 *
 * Auth endpoints (register / login / refresh / logout) go through the
 * Next.js proxy at /api/auth/* — that's where we manage the httpOnly
 * refresh-token cookie. See src/lib/auth/proxy.ts for those.
 *
 * Request interceptor:  attach `Authorization: Bearer <token>` from the
 *                       in-memory access token (read-through every call so
 *                       rotations land immediately).
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

export interface ApiClientOptions {
  /** Read-through getter for the in-memory access token. */
  getAccessToken: () => string | null;
  /** Returns a new access token, or null if the refresh failed (revoked/expired). */
  refreshAccessToken: () => Promise<string | null>;
}

export class ApiClient {
  private readonly http: AxiosInstance;
  private refreshing: Promise<string | null> | null = null;

  constructor(opts: ApiClientOptions) {
    this.http = axios.create({
      baseURL: env.apiBaseUrl,
      headers: { "Content-Type": "application/json" },
    });

    this.http.interceptors.request.use((config) => {
      const token = opts.getAccessToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
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

        const newToken = await this.singleFlightRefresh(opts);
        if (!newToken) return Promise.reject(ApiError.fromAxios(error));

        config._retried = true;
        config.headers.Authorization = `Bearer ${newToken}`;
        return this.http.request(config);
      },
    );
  }

  private async singleFlightRefresh(
    opts: ApiClientOptions,
  ): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = opts.refreshAccessToken().finally(() => {
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
