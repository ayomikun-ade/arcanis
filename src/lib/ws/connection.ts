/**
 * Low-level WebSocket lifecycle manager. Pure JS; no React.
 *
 * Responsibilities:
 *   - open the socket with the current access token
 *   - dispatch inbound frames to a callback
 *   - reconnect on transient failures with exponential backoff
 *   - on close 4001 (access token expired) → refresh → reconnect
 *   - on close 4003 (token invalid)        → call `onAuthDead`, stop trying
 *
 * The React layer (WsProvider) instantiates one of these per signed-in
 * session and unsubscribes on logout.
 */

import { wsUrl } from "@/lib/env";
import {
  WS_CLOSE_TOKEN_EXPIRED,
  WS_CLOSE_TOKEN_INVALID,
  type WsClientSendFrame,
  type WsServerFrame,
} from "@/lib/api/types";

export type WsStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface WsConnectionOptions {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onFrame: (frame: WsServerFrame) => void;
  onStatusChange: (status: WsStatus) => void;
  /** 4003 — token invalid. The session is dead; stop trying, force re-login. */
  onAuthDead: () => void;
}

/** Initial backoff 500ms, doubling, capped at 30s. */
const RECONNECT_BACKOFF_MIN_MS = 500;
const RECONNECT_BACKOFF_MAX_MS = 30_000;

export class WsConnection {
  private ws: WebSocket | null = null;
  private status: WsStatus = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private stopped = false;

  constructor(private readonly opts: WsConnectionOptions) {}

  /** Open the connection. Idempotent — does nothing if already open. */
  connect(): void {
    if (this.stopped) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    const token = this.opts.getAccessToken();
    if (!token) {
      this.setStatus("disconnected");
      return;
    }
    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    this.openSocket(token);
  }

  /** Close the connection and stop reconnect attempts. */
  disconnect(): void {
    this.stopped = true;
    this.cancelReconnect();
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        ws.close(1000, "client requested");
      } catch {
        /* ignore */
      }
    }
    this.setStatus("disconnected");
  }

  /** Send a frame. Returns false if the socket isn't open right now. */
  send(frame: WsClientSendFrame): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(frame));
    return true;
  }

  getStatus(): WsStatus {
    return this.status;
  }

  /* ────────── internals ────────── */

  private openSocket(token: string): void {
    const url = wsUrl("/ws", token);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error("[ws] failed to construct WebSocket", err);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");
    });

    ws.addEventListener("message", (event) => {
      try {
        const frame = JSON.parse(event.data as string) as WsServerFrame;
        this.opts.onFrame(frame);
      } catch (err) {
        console.error("[ws] non-JSON frame", err, event.data);
      }
    });

    ws.addEventListener("error", (event) => {
      console.warn("[ws] error event", event);
      // Errors are followed by a close event; let the close handler decide
      // whether to reconnect.
    });

    ws.addEventListener("close", (event) => {
      if (this.ws === ws) this.ws = null;

      if (this.stopped) {
        this.setStatus("disconnected");
        return;
      }

      if (event.code === WS_CLOSE_TOKEN_INVALID) {
        // 4003 — token was tampered or never valid. Auth is dead.
        this.stopped = true;
        this.setStatus("disconnected");
        this.opts.onAuthDead();
        return;
      }

      if (event.code === WS_CLOSE_TOKEN_EXPIRED) {
        // 4001 — refresh the access token in-band and retry immediately.
        void this.refreshAndReconnect();
        return;
      }

      // Anything else (1006 network, 1011 server error, 1001 going away…)
      // → backoff and retry.
      this.scheduleReconnect();
    });
  }

  private async refreshAndReconnect(): Promise<void> {
    this.setStatus("reconnecting");
    const newToken = await this.opts.refreshAccessToken();
    if (this.stopped) return;
    if (!newToken) {
      // Refresh-token cookie is also dead → fall through to onAuthDead so
      // the UI can route the user to /login.
      this.opts.onAuthDead();
      return;
    }
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.cancelReconnect();
    this.setStatus("reconnecting");
    const attempt = this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BACKOFF_MIN_MS * 2 ** attempt,
      RECONNECT_BACKOFF_MAX_MS,
    );
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(next: WsStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.opts.onStatusChange(next);
  }
}
