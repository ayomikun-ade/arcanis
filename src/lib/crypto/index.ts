/**
 * Public surface of the crypto layer.
 *
 * Anywhere outside `src/lib/crypto/`, prefer importing from this module
 * rather than the underlying files — internal layout may shift but the
 * exports here are stable.
 */

export {
  createIdentity,
  exportPublicKey,
  generateIdentityKeys,
  generateSalt,
  importPublicKey,
  unwrapPrivateKey,
  wrapPrivateKey,
  type ExportedIdentity,
  type IdentityKeys,
} from "./keys";

export {
  decryptMessage,
  encryptMessage,
  type EncryptedPayload,
} from "./messages";

export { CryptoError, type CryptoErrorCode } from "./errors";

export { bufToBase64, base64ToBuf, utf8Encode, utf8Decode } from "./base64";
