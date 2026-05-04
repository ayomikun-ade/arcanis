"use client";

/**
 * WsProvider — owns the singleton WebSocket connection for the signed-in
 * session. Three jobs:
 *
 *   1. Open / close the WebSocket as the auth state transitions.
 *   2. Route inbound frames into the TanStack Query cache (incoming
 *      messages → messages cache + conversations bump; presence frames →
 *      presence map).
 *   3. Expose the connection status + a send() function via context so
 *      the rest of the app can react.
 *
 * On WS close 4003 (token invalid / tampered), we forcibly log out and
 * route the user to /login — the session is irrecoverable.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import {
  WsConnection,
  type WsStatus,
} from "./connection";
import { queryKeys } from "@/lib/queries";
import type {
  MessageResponse,
  WsClientSendFrame,
  WsServerFrame,
} from "@/lib/api/types";

interface WsContextValue {
  status: WsStatus;
  /** userId -> true when known online; false when known offline; absent = unknown. */
  presence: Readonly<Record<string, boolean>>;
  send: (frame: WsClientSendFrame) => boolean;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const { state, getAccessToken, refreshAccessToken, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  // Refs for things the connection callbacks read but that we don't want
  // baked into the connection's identity.
  const myUserIdRef = useRef<string | null>(null);
  const connectionRef = useRef<WsConnection | null>(null);

  // Keep the user-id ref synced so the frame handler can compare.
  useEffect(() => {
    myUserIdRef.current =
      state.status === "authenticated" ? state.user.id : null;
  }, [state]);

  /* ────────── frame routing ────────── */

  const onFrame = useCallback(
    (frame: WsServerFrame) => {
      switch (frame.event) {
        case "message.receive": {
          // The frame arrives at the recipient; the peer is the sender.
          const peerId = frame.from_user_id;
          const newMessage: MessageResponse = {
            id: frame.id,
            from_user_id: frame.from_user_id,
            to_user_id: frame.to_user_id,
            payload: frame.payload,
            delivered: true,
            created_at: frame.created_at,
          };

          // Only update the messages cache if it already exists — we don't
          // want to seed an incomplete cache for a thread the user hasn't
          // opened yet (would prevent the eventual refetch from showing
          // older history).
          type MessagesCache = {
            pages: MessageResponse[][];
            pageParams: unknown[];
          };
          const existing = queryClient.getQueryData<MessagesCache>(
            queryKeys.messages(peerId),
          );
          if (existing && existing.pages.length > 0) {
            queryClient.setQueryData<MessagesCache>(
              queryKeys.messages(peerId),
              (old) => {
                if (!old) return old;
                const [first, ...rest] = old.pages;
                // De-dup in case the same message id is already there
                // (e.g. our own message echoed back, or a retry).
                if (first?.some((m) => m.id === newMessage.id)) return old;
                return {
                  ...old,
                  pages: [[newMessage, ...(first ?? [])], ...rest],
                };
              },
            );
          }

          // Always bump the conversations list — new last_message_at, and
          // for a brand-new contact this also adds the thread to the list.
          void queryClient.invalidateQueries({
            queryKey: queryKeys.conversations(),
          });
          break;
        }

        case "user.online":
        case "user.offline": {
          const isOnline = frame.event === "user.online";
          setPresence((prev) =>
            prev[frame.user_id] === isOnline
              ? prev
              : { ...prev, [frame.user_id]: isOnline },
          );
          break;
        }

        case "error": {
          console.warn("[ws] server error frame:", frame.detail);
          break;
        }
      }
    },
    [queryClient],
  );

  /* ────────── auth-dead handler ────────── */

  const onAuthDead = useCallback(() => {
    void logout().then(() => router.replace("/login"));
  }, [logout, router]);

  /* ────────── connection lifecycle ────────── */

  useEffect(() => {
    if (state.status !== "authenticated") {
      // Tear down any previous connection on logout / lock.
      connectionRef.current?.disconnect();
      connectionRef.current = null;
      setStatus("disconnected");
      setPresence({});
      return;
    }

    const conn = new WsConnection({
      // Read-through against the same in-memory token AuthProvider holds —
      // a REST-side refresh (via the axios 401 interceptor) is picked up
      // immediately here too.
      getAccessToken,
      refreshAccessToken,
      onFrame,
      onStatusChange: setStatus,
      onAuthDead,
    });

    connectionRef.current = conn;
    conn.connect();

    return () => {
      conn.disconnect();
      if (connectionRef.current === conn) connectionRef.current = null;
    };
  }, [
    state.status,
    onFrame,
    onAuthDead,
    getAccessToken,
    refreshAccessToken,
  ]);

  /* ────────── send wrapper ────────── */

  const send = useCallback((frame: WsClientSendFrame): boolean => {
    return connectionRef.current?.send(frame) ?? false;
  }, []);

  const value = useMemo<WsContextValue>(
    () => ({ status, presence, send }),
    [status, presence, send],
  );

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWs must be used inside <WsProvider>");
  return ctx;
}
