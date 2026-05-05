"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sent02Icon } from "@hugeicons/core-free-icons";

import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { useSendMessage } from "@/lib/hooks/use-send-message";
import { usePublicKey } from "@/lib/queries";

interface ComposerProps {
  recipientUserId: string;
  /** Called after a message has been sent successfully — used to scroll the thread. */
  onSent?: () => void;
}

export function Composer({ recipientUserId, onSent }: ComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const send = useSendMessage(recipientUserId);
  const recipientKey = usePublicKey(recipientUserId);
  const isReady = !!recipientKey.data;

  // Focus the input on mount and whenever the active conversation changes.
  // Standard messenger keyboard ergonomics — saves the user a click.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [recipientUserId]);

  const submit = async () => {
    const value = text.trim();
    if (!value || send.isPending || !isReady) return;
    try {
      await send.mutateAsync(value);
      setText("");
      onSent?.();
      textareaRef.current?.focus();
    } catch {
      // Error surfaced via send.error below — no rethrow.
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const placeholder = isReady
    ? "Type an encrypted message…"
    : recipientKey.isError
      ? "Couldn't load this contact's identity."
      : "Loading recipient identity…";

  return (
    <div className="flex flex-col gap-2 border-t-2 border-border bg-card p-3">
      {send.error && (
        <Alert variant="destructive">
          {send.error instanceof Error
            ? send.error.message
            : "Couldn't send. Try again."}
        </Alert>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 max-h-40"
          disabled={send.isPending || !isReady}
          aria-label="Message"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={send.isPending || !isReady || text.trim().length === 0}
          aria-label="Send"
          className="grid place-items-center size-11 shrink-0 rounded-base border-2 border-border bg-primary text-primary-foreground shadow-brutal-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[3px] active:translate-y-[3px] disabled:opacity-60 disabled:pointer-events-none"
        >
          {send.isPending || !isReady ? (
            <Spinner size={18} className="text-primary-foreground" />
          ) : (
            <HugeiconsIcon icon={Sent02Icon} size={18} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  );
}
