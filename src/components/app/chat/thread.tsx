"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  LockIcon,
  MessageMultiple01Icon,
} from "@hugeicons/core-free-icons";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth, type AuthState } from "@/lib/auth";
import { useDecryptedMessages } from "@/lib/hooks/use-decrypted-messages";
import { useMessages } from "@/lib/queries";
import { useWs } from "@/lib/ws/context";
import type { MessageResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

interface PeerSummary {
  display_name: string;
  username: string;
}

interface ChatThreadProps {
  userId: string;
  peer: PeerSummary | null;
}

export function ChatThread({ userId, peer }: ChatThreadProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatHeader userId={userId} peer={peer} />
      <ChatBody userId={userId} />
      <Composer
        recipientUserId={userId}
        onSent={() => {
          // ChatBody handles auto-scroll on new last-id; the outgoing message
          // arrives via the messages query cache which triggers the effect.
        }}
      />
    </div>
  );
}

/* ───────────────── Header ───────────────── */

function ChatHeader({
  userId,
  peer,
}: {
  userId: string;
  peer: PeerSummary | null;
}) {
  const { presence } = useWs();
  const isOnline = presence[userId] === true;

  return (
    <header className="flex items-center gap-3 border-b-2 border-border bg-card px-4 py-3">
      <Link
        href="/app"
        aria-label="Back to conversations"
        className="grid place-items-center size-9 rounded-base border-2 border-border bg-card hover:bg-muted shadow-brutal-sm md:hidden"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2.5} />
      </Link>
      {peer ? (
        <>
          <div className="relative shrink-0">
            <Avatar name={peer.display_name} size="md" />
            {isOnline && (
              <span
                aria-label="Online"
                title="Online"
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 block size-3 rounded-full",
                  "border-2 border-card bg-success",
                )}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold leading-tight">
              {peer.display_name}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {isOnline ? "Online" : `@${peer.username}`}
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1">
          <Spinner size={18} />
        </div>
      )}
      <Badge variant="success" className="text-[10px]">
        <HugeiconsIcon icon={LockIcon} size={10} strokeWidth={2.5} />
        E2EE
      </Badge>
    </header>
  );
}

/* ───────────────── Body (scrollable list of bubbles) ───────────────── */

function ChatBody({ userId }: { userId: string }) {
  const { state } = useAuth();
  const me =
    state.status === "authenticated"
      ? (state as Extract<AuthState, { status: "authenticated" }>)
      : null;
  const messages = useMessages(userId);

  // Pages come back newest-first per page. Flatten and reverse → chronological.
  const ordered = useMemo<MessageResponse[]>(() => {
    const pages = messages.data?.pages ?? [];
    return pages.flatMap((p) => p).slice().reverse();
  }, [messages.data]);

  const decrypted = useDecryptedMessages(
    ordered,
    me?.keys ?? null,
    me?.user.id ?? null,
  );

  /* Auto-scroll behaviour:
   *  - First mount with messages              → bottom
   *  - New message arrives at the end          → bottom (if user was near bottom)
   *  - Older history prepended (load earlier)  → preserve visible position
   */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevFirstId = useRef<string | null>(null);
  const prevLastId = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);
  const prevScrollTop = useRef(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = ordered[0]?.id ?? null;
    const lastId = ordered[ordered.length - 1]?.id ?? null;
    const firstChanged =
      firstId !== null && firstId !== prevFirstId.current;
    const lastChanged = lastId !== null && lastId !== prevLastId.current;
    const isFirstPopulation =
      prevFirstId.current === null && firstId !== null;

    if (
      firstChanged &&
      !isFirstPopulation &&
      prevFirstId.current !== null
    ) {
      // Older messages prepended — keep the user where they were.
      const heightDelta = el.scrollHeight - prevScrollHeight.current;
      el.scrollTop = prevScrollTop.current + heightDelta;
    } else if (lastChanged || isFirstPopulation) {
      // New message at the bottom or initial population — scroll to latest.
      el.scrollTop = el.scrollHeight;
    }

    prevFirstId.current = firstId;
    prevLastId.current = lastId;
    prevScrollHeight.current = el.scrollHeight;
    prevScrollTop.current = el.scrollTop;
  }, [ordered]);

  if (messages.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center bg-dotted">
        <Spinner size={24} />
      </div>
    );
  }
  if (messages.isError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-dotted px-6 text-center">
        <p className="text-sm font-medium text-destructive">
          Couldn&apos;t load messages.{" "}
          <button
            type="button"
            onClick={() => void messages.refetch()}
            className="font-bold underline underline-offset-2"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }
  if (ordered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-dotted px-6 py-10 text-center">
        <div className="grid size-16 place-items-center rounded-base border-2 border-border bg-accent text-accent-foreground shadow-brutal-sm">
          <HugeiconsIcon
            icon={MessageMultiple01Icon}
            size={28}
            strokeWidth={2}
          />
        </div>
        <p className="mt-4 font-bold">Say hi.</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          This thread is empty. Send the first encrypted message — only the
          two of you can read it.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="bg-dotted flex-1 overflow-y-auto px-3 py-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {messages.hasNextPage && (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void messages.fetchNextPage()}
              disabled={messages.isFetchingNextPage}
            >
              {messages.isFetchingNextPage ? (
                <>
                  <Spinner size={14} /> Loading…
                </>
              ) : (
                "Load earlier messages"
              )}
            </Button>
          </div>
        )}
        {ordered.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            decrypted={decrypted.get(m.id)}
            outgoing={m.from_user_id === me?.user.id}
          />
        ))}
      </div>
    </div>
  );
}
