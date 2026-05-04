/**
 * Single crypto error class with a `code` discriminator.
 *
 * We use a class only to inherit Error semantics (stack traces, native
 * try/catch, devtools display). All variants share one type — callers
 * branch on `error.code`, not on `instanceof SomeSubclass`.
 *
 * `error.message` is intentionally end-user friendly — it can flow straight
 * into a toast. The technical detail (the underlying DOMException, etc.)
 * lives on `error.cause` for `console.error` and bug reports.
 */

export type CryptoErrorCode =
  /** Password didn't unlock the saved keys. */
  | "wrong-password"
  /** Generic message decryption failure (tampered, wrong key, malformed). */
  | "message-unreadable"
  /** A public key fetched from the server didn't parse. */
  | "bad-contact-key";

export class CryptoError extends Error {
  readonly code: CryptoErrorCode;

  constructor(code: CryptoErrorCode, options?: { cause?: unknown }) {
    super(MESSAGES[code], options);
    this.name = "CryptoError";
    this.code = code;
  }
}

const MESSAGES: Record<CryptoErrorCode, string> = {
  "wrong-password": "Wrong password. Try again.",
  "message-unreadable":
    "This message couldn't be unlocked. It may be corrupted or from a previous account.",
  "bad-contact-key":
    "Couldn't load this contact's identity. They may need to sign in again.",
};
