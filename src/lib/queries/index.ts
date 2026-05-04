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
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
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
  messages: (userId: string) => ["messages", userId] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  publicKey: (userId: string) => ["users", userId, "public-key"] as const,
};

const MESSAGES_PAGE_SIZE = 50;

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
): UseInfiniteQueryResult<{ pages: MessageResponse[][]; pageParams: unknown[] }> {
  const { client, state } = useAuth();
  return useInfiniteQuery({
    queryKey: queryKeys.messages(userId ?? ""),
    queryFn: ({ pageParam }) =>
      client.getMessages(userId!, {
        limit: MESSAGES_PAGE_SIZE,
        before: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage): string | undefined => {
      // Empty page or short page → no more history.
      if (lastPage.length < MESSAGES_PAGE_SIZE) return undefined;
      // API returns newest-first, so the last item in the page is the oldest.
      return lastPage[lastPage.length - 1]!.created_at;
    },
    enabled: state.status === "authenticated" && !!userId,
  });
}
