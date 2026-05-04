"use client";

/**
 * Encrypt + POST /messages mutation.
 *
 * Wraps the full client-side send flow:
 *   1. Get recipient's RSA public key (cached, see usePublicKey)
 *   2. encryptMessage(plaintext, recipientPub, myPub) → EncryptedPayload
 *   3. POST /messages
 *   4. Prepend the response to the messages cache so the bubble appears
 *      without a round-trip refetch
 *   5. Invalidate the conversations list so its `last_message_at` bumps
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import {
  encryptMessage,
  importPublicKey,
} from "@/lib/crypto";
import { queryKeys, usePublicKey } from "@/lib/queries";
import type { MessageResponse } from "@/lib/api";

export function useSendMessage(recipientUserId: string) {
  const { client, state } = useAuth();
  const publicKeyQuery = usePublicKey(recipientUserId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plaintext: string): Promise<MessageResponse> => {
      if (state.status !== "authenticated") {
        throw new Error("Not signed in");
      }
      if (!publicKeyQuery.data) {
        throw new Error("Recipient identity not loaded yet — try again in a moment.");
      }
      const recipientPub = await importPublicKey(publicKeyQuery.data.public_key);
      const payload = await encryptMessage(
        plaintext,
        recipientPub,
        state.keys.publicKey,
      );
      return client.sendMessage({ to: recipientUserId, payload });
    },
    onSuccess: (response) => {
      type Cache =
        | { pages: MessageResponse[][]; pageParams: unknown[] }
        | undefined;
      queryClient.setQueryData<Cache>(
        queryKeys.messages(recipientUserId),
        (old) => {
          if (!old || old.pages.length === 0) {
            return { pages: [[response]], pageParams: [undefined] };
          }
          const [first, ...rest] = old.pages;
          return {
            ...old,
            pages: [[response, ...(first ?? [])], ...rest],
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(),
      });
    },
  });
}
