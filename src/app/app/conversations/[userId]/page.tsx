"use client";

import { use } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ChatThread } from "@/components/app/chat/thread";
import { useConversations } from "@/lib/queries";
import type { UserSummary } from "@/lib/api";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function ConversationPage({ params }: PageProps) {
  const { userId } = use(params);
  const peer = usePeer(userId);
  return <ChatThread userId={userId} peer={peer} />;
}

/**
 * Best-effort peer summary for the chat header.
 *
 * The WhisperBox API has no direct GET /users/{id}, so we triangulate:
 *   1. The cached conversations list — fastest, present once they've
 *      messaged each other at least once.
 *   2. Any cached user-search result — covers the new-chat path where
 *      the user just clicked someone out of the sidebar's search.
 *
 * For a true cold deep-link (no cache hit either way) the header stays
 * blank until the conversations cache refreshes (e.g. after the first
 * message is sent and the conversations list invalidates).
 */
function usePeer(userId: string): {
  display_name: string;
  username: string;
} | null {
  const conversations = useConversations();
  const queryClient = useQueryClient();

  const fromConversation = conversations.data?.find(
    (c) => c.user_id === userId,
  );
  if (fromConversation) {
    return {
      display_name: fromConversation.display_name,
      username: fromConversation.username,
    };
  }

  // Scan every cached user-search query — keys look like
  // ["users", "search", "<some query>"] — for a record matching userId.
  // Whatever query the sidebar last ran will still be in cache.
  const searchCaches = queryClient.getQueriesData<UserSummary[]>({
    queryKey: ["users", "search"],
  });
  for (const [, data] of searchCaches) {
    const hit = data?.find((u) => u.id === userId);
    if (hit) {
      return {
        display_name: hit.display_name,
        username: hit.username,
      };
    }
  }

  return null;
}
