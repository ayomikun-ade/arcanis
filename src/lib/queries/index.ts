/**
 * TanStack Query hooks — typed wrappers around the ApiClient.
 *
 * Why these live here and not inside components: TanStack Query needs a
 * stable `queryKey` per query; centralising the keys here makes
 * invalidation and cache surgery (e.g. "after sending a message,
 * invalidate the conversations list and prepend to the messages list")
 * trivial later.
 */

"use client";

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import type {
  ConversationSummary,
  MessageResponse,
  PublicKeyResponse,
  UserSummary,
} from "@/lib/api";

export const queryKeys = {
  conversations: () => ["conversations"] as const,
  messages: (userId: string, before?: string) =>
    ["messages", userId, before ?? null] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  publicKey: (userId: string) => ["users", userId, "public-key"] as const,
};

/** All conversations for the current user, sorted newest first by the API. */
export function useConversations(): UseQueryResult<ConversationSummary[]> {
  const { client, state } = useAuth();
  return useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => client.getConversations(),
    enabled: state.status === "authenticated",
  });
}

/**
 * Debounced (by the caller) user search. Keeps the previous result while
 * a new query is in flight so the list doesn't flicker on every keystroke.
 */
export function useUserSearch(q: string): UseQueryResult<UserSummary[]> {
  const { client, state } = useAuth();
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.userSearch(trimmed),
    queryFn: () => client.searchUsers(trimmed),
    enabled: state.status === "authenticated" && trimmed.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** A single user's RSA-OAEP public key. Cached aggressively — keys are immutable. */
export function usePublicKey(
  userId: string | null,
): UseQueryResult<PublicKeyResponse> {
  const { client, state } = useAuth();
  return useQuery({
    queryKey: queryKeys.publicKey(userId ?? ""),
    queryFn: () => client.getPublicKey(userId!),
    enabled: state.status === "authenticated" && !!userId,
    staleTime: Infinity,
  });
}

/**
 * Message history for a thread. The `before` cursor enables pagination
 * (caller passes the timestamp of the oldest message they currently have).
 */
export function useMessages(
  userId: string | null,
  opts?: { limit?: number; before?: string },
): UseQueryResult<MessageResponse[]> {
  const { client, state } = useAuth();
  return useQuery({
    queryKey: queryKeys.messages(userId ?? "", opts?.before),
    queryFn: () => client.getMessages(userId!, opts),
    enabled: state.status === "authenticated" && !!userId,
  });
}
