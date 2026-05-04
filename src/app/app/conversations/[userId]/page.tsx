"use client";

/**
 * Single conversation view — placeholder until Stage 6 lands the real
 * thread. For now we render the chat header (so the route is navigable)
 * and a "thread coming soon" notice.
 */

import Link from "next/link";
import { use } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  LockIcon,
} from "@hugeicons/core-free-icons";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useConversations, useUserSearch } from "@/lib/queries";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function ConversationPage({ params }: PageProps) {
  const { userId } = use(params);
  return <ConversationView userId={userId} />;
}

function ConversationView({ userId }: { userId: string }) {
  const peer = usePeer(userId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b-2 border-border bg-card px-4 py-3">
        <Link
          href="/app"
          aria-label="Back to conversations"
          className="grid place-items-center size-9 rounded-base border-2 border-border bg-card hover:bg-muted shadow-brutal-sm md:hidden"
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            size={18}
            strokeWidth={2.5}
          />
        </Link>
        {peer ? (
          <>
            <Avatar name={peer.display_name} size="md" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold leading-tight">
                {peer.display_name}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                @{peer.username}
              </p>
            </div>
          </>
        ) : (
          <Spinner size={18} />
        )}
        <Badge variant="success" className="text-[10px]">
          <HugeiconsIcon icon={LockIcon} size={10} strokeWidth={2.5} />
          E2EE
        </Badge>
      </header>

      {/* Thread placeholder */}
      <div className="bg-dotted flex flex-1 items-center justify-center px-6 py-10 text-center">
        <div className="max-w-sm">
          <p className="font-bold">Encrypted thread loading…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Stage 6 will render message history and the composer here.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Best-effort peer lookup.
 *
 * Strategy:
 *  1. Look in the cached conversations list (the user is already messaging
 *     this person → 0 extra requests).
 *  2. Fall back to looking up by ID against the most recent search results
 *     (the user just clicked them out of a search result).
 *
 * Stage 6 will introduce a proper /users/{id} lookup or extract the peer
 * from the first received message; this is good enough for the placeholder.
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
  return fromSearch ?? null;
}
