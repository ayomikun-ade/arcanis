"use client";

/**
 * Batch-decrypt a stream of messages with a stable cache keyed by message id.
 *
 * Web Crypto's `subtle.decrypt` is async, so a naive "decrypt during render"
 * doesn't work. We hold the cache in a ref so it survives across re-renders
 * without re-running, and bump a counter to trigger a render once a batch
 * resolves. New messages get queued; already-decrypted messages are reused.
 */

import { useEffect, useReducer, useRef } from "react";

import {
  CryptoError,
  decryptMessage,
  type IdentityKeys,
} from "@/lib/crypto";
import type { MessageResponse } from "@/lib/api";

export type DecryptedMessage =
  | { kind: "ok"; text: string }
  | { kind: "fail"; reason: string };

export function useDecryptedMessages(
  messages: MessageResponse[] | undefined,
  keys: IdentityKeys | null,
  myUserId: string | null,
): Map<string, DecryptedMessage> {
  const cacheRef = useRef<Map<string, DecryptedMessage>>(new Map());
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!messages || !keys || !myUserId) return;
    const todo = messages.filter((m) => !cacheRef.current.has(m.id));
    if (todo.length === 0) return;

    let cancelled = false;
    Promise.all(
      todo.map(async (m): Promise<[string, DecryptedMessage]> => {
        try {
          const text = await decryptMessage(
            m.payload,
            keys.privateKey,
            m.from_user_id === myUserId,
          );
          return [m.id, { kind: "ok", text }];
        } catch (e) {
          const reason =
            e instanceof CryptoError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Couldn't decrypt this message.";
          return [m.id, { kind: "fail", reason }];
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      for (const [id, v] of entries) cacheRef.current.set(id, v);
      bump();
    });

    return () => {
      cancelled = true;
    };
  }, [messages, keys, myUserId]);

  return cacheRef.current;
}
