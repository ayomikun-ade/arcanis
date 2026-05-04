"use client";

import { use } from "react";

import { ChatThread } from "@/components/app/chat/thread";
import { useConversations, useUserSearch } from "@/lib/queries";

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
 *   1. Look in the cached conversations list (already messaging them).
 *   2. Fall back to whatever search results are already in cache.
 *
 * Stage 7 will also capture peer info from the first received WS frame,
 * which closes the deep-link case for a brand-new contact.
 */
function usePeer(userId: string) {
  const conversations = useConversations();
  const searchAll = useUserSearch("");
  const fromConversation = conversations.data?.find(
    (c) => c.user_id === userId,
  );
  if (fromConversation) {
    return {
      display_name: fromConversation.display_name,
      username: fromConversation.username,
    };
  }
  const fromSearch = searchAll.data?.find((u) => u.id === userId);
  return fromSearch
    ? { display_name: fromSearch.display_name, username: fromSearch.username }
    : null;
}
