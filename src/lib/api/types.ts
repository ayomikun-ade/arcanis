/**
 * Wire types — mirror exactly what the WhisperBox API sends and expects.
 *
 * Keep these dumb (no transforms, no derived fields). The auth context and
 * UI layers do any prettifying. If the API ever changes shape, the diff
 * lands here first.
 */

import type { EncryptedPayload } from "@/lib/crypto";

/* ─────────────────────────── Auth ─────────────────────────── */

export interface RegisterRequest {
  username: string;
  display_name: string;
  password: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: UserProfile;
}

export interface RefreshResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

/* ─────────────────────────── Users ─────────────────────────── */

export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
}

export interface PublicKeyResponse {
  public_key: string;
}

/* ───────────────────────── Messages ───────────────────────── */

export interface MessageResponse {
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: EncryptedPayload;
  delivered: boolean;
  created_at: string;
}

export interface ConversationSummary {
  user_id: string;
  display_name: string;
  username: string;
  last_message_at: string;
}

export interface SendMessageRequest {
  to: string;
  payload: EncryptedPayload;
}

/* ───────────────────────── WebSocket ───────────────────────── */

export interface WsClientSendFrame {
  event: "message.send";
  to: string;
  payload: EncryptedPayload;
}

export type WsServerFrame =
  | {
      event: "message.receive";
      id: string;
      from_user_id: string;
      to_user_id: string;
      payload: EncryptedPayload;
      created_at: string;
    }
  | { event: "user.online"; user_id: string }
  | { event: "user.offline"; user_id: string }
  | { event: "error"; detail: string };

/** WebSocket close codes documented in GUIDE.md. */
export const WS_CLOSE_TOKEN_EXPIRED = 4001;
export const WS_CLOSE_TOKEN_INVALID = 4003;
