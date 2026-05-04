/**
 * Per-message hybrid encryption.
 *
 * The wire payload (`EncryptedPayload`) is exactly what the WhisperBox API
 * stores and forwards — we never touch its shape, the server treats it as
 * an opaque JSON blob.
 *
 * Send flow:
 *   1. Generate a random 256-bit AES-GCM key + a random 96-bit IV
 *   2. ciphertext         = AES-GCM(key, iv, plaintext)
 *   3. encryptedKey        = RSA-OAEP(recipientPubKey, raw AES key)
 *   4. encryptedKeyForSelf = RSA-OAEP(senderPubKey,    raw AES key)
 *      (so the sender can still read their own message in their history)
 *
 * Receive flow:
 *   1. Pick the right wrapped key:
 *        if sender == me: encryptedKeyForSelf
 *        else:            encryptedKey
 *   2. Decrypt that with my RSA-OAEP private key -> raw AES bytes
 *   3. Re-import as an AES-GCM key
 *   4. AES-GCM-decrypt the ciphertext + iv
 */

import { AES_GCM_IV_LENGTH, AES_GCM_KEY_LENGTH } from "./constants";
import { base64ToBuf, bufToBase64, utf8Decode, utf8Encode } from "./base64";
import { CryptoError } from "./errors";

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}

async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_GCM_KEY_LENGTH },
    true, // extractable so we can wrap it with RSA-OAEP for transport
    ["encrypt", "decrypt"],
  );
}

async function rsaWrap(
  rawAesKey: ArrayBuffer,
  rsaPublicKey: CryptoKey,
): Promise<string> {
  const wrapped = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawAesKey,
  );
  return bufToBase64(wrapped);
}

/**
 * Encrypt a plaintext string for one recipient.
 * `myPublicKey` is included so we (the sender) can read this same message
 * later from /conversations/{userId}/messages.
 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: CryptoKey,
  myPublicKey: CryptoKey,
): Promise<EncryptedPayload> {
  const aesKey = await generateAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));

  const [ciphertext, rawAesKey] = await Promise.all([
    crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      aesKey,
      utf8Encode(plaintext) as BufferSource,
    ),
    crypto.subtle.exportKey("raw", aesKey),
  ]);

  const [encryptedKey, encryptedKeyForSelf] = await Promise.all([
    rsaWrap(rawAesKey, recipientPublicKey),
    rsaWrap(rawAesKey, myPublicKey),
  ]);

  return {
    ciphertext: bufToBase64(ciphertext),
    iv: bufToBase64(iv),
    encryptedKey,
    encryptedKeyForSelf,
  };
}

/**
 * Decrypt a payload using my private key.
 * `wasSentByMe` decides which copy of the wrapped AES key we unwrap —
 * the recipient copy or the self copy.
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  myPrivateKey: CryptoKey,
  wasSentByMe: boolean,
): Promise<string> {
  const wrappedAesB64 = wasSentByMe
    ? payload.encryptedKeyForSelf
    : payload.encryptedKey;

  try {
    const rawAesKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      myPrivateKey,
      base64ToBuf(wrappedAesB64) as BufferSource,
    );
    const aesKey = await crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintextBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuf(payload.iv) as BufferSource },
      aesKey,
      base64ToBuf(payload.ciphertext) as BufferSource,
    );
    return utf8Decode(plaintextBytes);
  } catch (cause) {
    throw new CryptoError("message-unreadable", { cause });
  }
}
