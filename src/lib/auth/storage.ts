/**
 * IndexedDB persistence for the *wrapped* identity blob.
 *
 * What we persist:
 *   - the user profile (id, username, display_name, ...)
 *   - the wrapped private-key blob (still encrypted with the password-derived
 *     KEK — the server has the same blob)
 *   - the PBKDF2 salt
 *   - the public key (base64 SPKI)
 *
 * What we never persist:
 *   - the unwrapped RSA private CryptoKey (memory only, non-extractable)
 *   - the password (memory only, lifetime = the unwrap call)
 *   - the access token (memory only, ~15min TTL anyway)
 *   - the refresh token (httpOnly cookie, server-readable only)
 *
 * Why store the wrapped blob locally at all? So a returning user gets an
 * "Unlock with password" screen instead of a full re-login on every cold
 * reload. The blob is encrypted; a thief reading IndexedDB still has to
 * brute-force PBKDF2 with 600k iterations per password guess.
 */

import { get, set, del, createStore } from "idb-keyval";

import type { UserProfile } from "@/lib/api/types";

const STORE = createStore("arcanis", "session");
const KEY = "identity";

export interface PersistedIdentity {
  user: UserProfile;
  /** base64 of (iv || AES-GCM ciphertext). */
  wrappedPrivateKey: string;
  /** base64 of the 128-bit salt. */
  pbkdf2Salt: string;
  /** base64 SPKI of the public key. */
  publicKey: string;
}

export async function loadPersistedIdentity(): Promise<PersistedIdentity | null> {
  try {
    const value = await get<PersistedIdentity>(KEY, STORE);
    return value ?? null;
  } catch {
    // IndexedDB can fail in private browsing / incognito on Safari.
    // Treat that as "no saved identity" rather than blowing up.
    return null;
  }
}

export async function savePersistedIdentity(
  identity: PersistedIdentity,
): Promise<void> {
  await set(KEY, identity, STORE);
}

export async function clearPersistedIdentity(): Promise<void> {
  await del(KEY, STORE).catch(() => undefined);
}
