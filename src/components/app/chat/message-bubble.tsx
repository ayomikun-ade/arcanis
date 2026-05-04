"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import type { MessageResponse } from "@/lib/api";
import type { DecryptedMessage } from "@/lib/hooks/use-decrypted-messages";

interface MessageBubbleProps {
  message: MessageResponse;
  decrypted: DecryptedMessage | undefined;
  outgoing: boolean;
}

export function MessageBubble({
  message,
  decrypted,
  outgoing,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        outgoing ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-base border-2 border-border px-3 py-2 shadow-brutal-sm",
          outgoing
            ? "bg-secondary text-secondary-foreground"
            : "bg-card text-card-foreground",
          decrypted?.kind === "fail" &&
            "bg-destructive text-destructive-foreground",
        )}
      >
        <BubbleBody decrypted={decrypted} />
        <p
          className={cn(
            "mt-1 text-[10px] font-bold uppercase tracking-tight opacity-70",
            outgoing ? "text-right" : "text-left",
          )}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

function BubbleBody({
  decrypted,
}: {
  decrypted: DecryptedMessage | undefined;
}) {
  if (!decrypted) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium opacity-70">
        <HugeiconsIcon
          icon={Loading03Icon}
          size={14}
          strokeWidth={2}
          className="animate-spin"
        />
        Decrypting…
      </div>
    );
  }
  if (decrypted.kind === "fail") {
    return (
      <div className="flex items-start gap-2 text-sm font-medium">
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={14}
          strokeWidth={2.5}
          className="mt-0.5 shrink-0"
        />
        <span>Couldn&apos;t decrypt this message.</span>
      </div>
    );
  }
  return (
    <p className="text-sm font-medium leading-snug whitespace-pre-wrap break-words">
      {decrypted.text}
    </p>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
