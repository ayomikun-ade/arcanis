/**
 * Algorithm parameters for the Arcanis E2EE scheme.
 *
 * These constants must stay in sync with the WhisperBox spec — the server
 * stores opaque blobs but the client side has to agree with itself across
 * register / login / send / receive.
 */

export const RSA_HASH = "SHA-256" as const;

export const RSA_KEYGEN_PARAMS: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
  hash: RSA_HASH,
};

export const RSA_IMPORT_PARAMS: RsaHashedImportParams = {
  name: "RSA-OAEP",
  hash: RSA_HASH,
};

export const AES_GCM_KEY_LENGTH = 256;
export const AES_GCM_IV_LENGTH = 12; // 96-bit IV per AES-GCM spec

export const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation for SHA-256
export const PBKDF2_HASH = "SHA-256" as const;
export const PBKDF2_SALT_LENGTH = 16; // 128-bit salt per the WhisperBox guide
