/**
 * Binary <-> string helpers used throughout the crypto layer.
 *
 * The Web Crypto API works exclusively in `ArrayBuffer` / `Uint8Array`, but
 * everything that flows over the wire (or into IndexedDB) needs to be a
 * string. We standardise on plain base64 because that's what the WhisperBox
 * API accepts on every field that carries a key or a ciphertext.
 */

/**
 * Note: we explicitly type these as `Uint8Array<ArrayBuffer>` (not the
 * default `Uint8Array<ArrayBufferLike>`) so they satisfy `BufferSource`
 * directly. TS's newer lib.dom.d.ts distinguishes ArrayBuffer from
 * SharedArrayBuffer at the type level — pinning the backing buffer here
 * means callers don't have to sprinkle `as BufferSource` everywhere.
 */

export function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  // String.fromCharCode + btoa is the fastest no-dep path that works
  // identically in browsers and modern Node.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength)),
    );
  }
  return btoa(binary);
}

export function base64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8Encode(value: string): Uint8Array<ArrayBuffer> {
  // TextEncoder always returns a Uint8Array backed by a regular ArrayBuffer.
  return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

export function utf8Decode(buf: ArrayBuffer | Uint8Array): string {
  return new TextDecoder().decode(buf);
}
