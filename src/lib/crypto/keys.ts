/**
 * Identity key management for Arcanis.
 *
 * On register:
 *   - generateIdentityKeys()      -> RSA-OAEP 2048 keypair (in-memory)
 *   - generateSalt()              -> 128-bit random salt
 *   - deriveWrappingKey(pw, salt) -> AES-GCM key from PBKDF2(pw)
 *   - wrapPrivateKey(...)         -> base64 blob to send to server
 *
 * On login (the "unwrap" step):
 *   - deriveWrappingKey(pw, salt) -> rebuild the AES-GCM key client-side
 *   - unwrapPrivateKey(...)       -> RSA-OAEP private key, NON-EXTRACTABLE
 *
 * The unwrapped private key is held by `CryptoKey` references in JS memory
 * only — Web Crypto refuses to export it as bytes once we set
 * `extractable: false`. That's the whole point of using the platform's
 * crypto layer instead of a userland JS RSA library.
 *
 * Wrapped-blob layout:
 *
 *   [ iv (12 bytes) | AES-GCM ciphertext (variable, includes 16-byte tag) ]
 *
 * base64'd as a single string sent to the server as `wrapped_private_key`.
 * The server stores it opaquely and hands it back at /auth/login. The IV
 * is fresh per-registration; AES-GCM's authentication tag throws on a
 * wrong-password unwrap attempt, which we surface as
 * CryptoError("wrong-password").
 *
 * Note on choice: the WhisperBox guide nominally specifies AES-KW for this
 * step, but Web Crypto's AES-KW requires the wrapped input length to be a
 * multiple of 8 bytes — which PKCS#8 RSA-2048 export is *not* (~84% miss
 * rate empirically across browsers and Node). AES-GCM has no alignment
 * requirement, gives us the same authentication-on-unwrap behaviour, and
 * is the same primitive used elsewhere in the system (per-message
 * encryption). The server never inspects the blob, so the wire format is
 * a purely client-side concern.
 */

import {
  AES_GCM_IV_LENGTH,
  AES_GCM_KEY_LENGTH,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_LENGTH,
  RSA_IMPORT_PARAMS,
  RSA_KEYGEN_PARAMS,
} from "./constants";
import { base64ToBuf, bufToBase64, utf8Encode } from "./base64";
import { CryptoError } from "./errors";

export interface IdentityKeys {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface ExportedIdentity {
  publicKey: string; // base64 SPKI
  wrappedPrivateKey: string; // base64 of (iv || AES-GCM ciphertext)
  pbkdf2Salt: string; // base64
}

/** Generate a fresh RSA-OAEP 2048 keypair. */
export async function generateIdentityKeys(): Promise<IdentityKeys> {
  const pair = await crypto.subtle.generateKey(
    RSA_KEYGEN_PARAMS,
    true, // extractable — needed once, to wrap the private key for storage
    ["encrypt", "decrypt"],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** Random 128-bit salt for PBKDF2. */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(
    new Uint8Array(new ArrayBuffer(PBKDF2_SALT_LENGTH)),
  );
}

/** Random 96-bit IV for AES-GCM. */
function generateIv(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(
    new Uint8Array(new ArrayBuffer(AES_GCM_IV_LENGTH)),
  );
}

/**
 * Derive an AES-GCM-256 wrapping key from the user's password + salt.
 *
 * PBKDF2 with 600k iterations (OWASP 2023 recommendation for SHA-256)
 * makes brute-forcing a stolen wrapped blob expensive. The derived key
 * carries `wrapKey`/`unwrapKey` usages so it can be passed to
 * crypto.subtle.wrapKey / unwrapKey directly.
 */
async function deriveWrappingKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    utf8Encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    passwordKey,
    { name: "AES-GCM", length: AES_GCM_KEY_LENGTH },
    false, // never expose the wrapping key itself
    ["wrapKey", "unwrapKey"],
  );
}

/** Export the public half as base64 SPKI — safe to send to the server. */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return bufToBase64(spki);
}

/** Re-import a base64 SPKI public key (e.g. a recipient's, fetched from the server). */
export async function importPublicKey(b64Spki: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      "spki",
      base64ToBuf(b64Spki),
      RSA_IMPORT_PARAMS,
      true,
      ["encrypt"],
    );
  } catch (cause) {
    throw new CryptoError("bad-contact-key", { cause });
  }
}

/**
 * Wrap (encrypt) the RSA private key with the password-derived AES-GCM key.
 * Returns the base64 blob you'd send to POST /auth/register as
 * `wrapped_private_key`. Layout: `iv (12 bytes) || ciphertext`.
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const wrappingKey = await deriveWrappingKey(password, salt);
  const iv = generateIv();
  const ciphertext = await crypto.subtle.wrapKey(
    "pkcs8",
    privateKey,
    wrappingKey,
    { name: "AES-GCM", iv },
  );

  const blob = new Uint8Array(
    new ArrayBuffer(AES_GCM_IV_LENGTH + ciphertext.byteLength),
  );
  blob.set(iv, 0);
  blob.set(new Uint8Array(ciphertext), AES_GCM_IV_LENGTH);
  return bufToBase64(blob);
}

/**
 * Unwrap the private key into a non-extractable CryptoKey held in memory.
 * Throws CryptoError("wrong-password") if the password is wrong — the
 * AES-GCM auth tag verification fails noisily on KEK mismatch.
 */
export async function unwrapPrivateKey(
  wrappedB64: string,
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(password, base64ToBuf(saltB64));
  const blob = base64ToBuf(wrappedB64);
  const iv = new Uint8Array(blob.buffer, blob.byteOffset, AES_GCM_IV_LENGTH);
  const ciphertext = new Uint8Array(
    blob.buffer,
    blob.byteOffset + AES_GCM_IV_LENGTH,
    blob.byteLength - AES_GCM_IV_LENGTH,
  );
  try {
    return await crypto.subtle.unwrapKey(
      "pkcs8",
      ciphertext,
      wrappingKey,
      { name: "AES-GCM", iv },
      RSA_IMPORT_PARAMS,
      false, // <-- key cannot be exported back to bytes, ever
      ["decrypt"],
    );
  } catch (cause) {
    throw new CryptoError("wrong-password", { cause });
  }
}

/**
 * Convenience: do everything register needs in one call.
 * Returns { keys, exported } — keep `keys` in memory for the rest of the
 * session, send `exported` to POST /auth/register.
 */
export async function createIdentity(
  password: string,
): Promise<{ keys: IdentityKeys; exported: ExportedIdentity }> {
  const keys = await generateIdentityKeys();
  const salt = generateSalt();
  const [publicKey, wrappedPrivateKey] = await Promise.all([
    exportPublicKey(keys.publicKey),
    wrapPrivateKey(keys.privateKey, password, salt),
  ]);
  return {
    keys,
    exported: {
      publicKey,
      wrappedPrivateKey,
      pbkdf2Salt: bufToBase64(salt),
    },
  };
}
