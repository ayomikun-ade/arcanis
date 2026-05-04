/**
 * Headless roundtrip test for the crypto layer.
 * Runs the same flow as the /crypto-test page but in Node so we can verify
 * without spinning up a browser. Node 20+ exposes the Web Crypto API at
 * `globalThis.crypto`, which is what our modules use.
 *
 *   pnpm crypto:smoke
 */

import {
  createIdentity,
  decryptMessage,
  encryptMessage,
  exportPublicKey,
  importPublicKey,
  unwrapPrivateKey,
} from "../src/lib/crypto";

let failed = 0;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) {
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("Arcanis crypto smoke test\n");

  // Register Alice & Bob
  const aliceReg = await createIdentity("alice-correct-horse-battery-staple");
  const bobReg = await createIdentity("bob-trustno1-but-make-it-strong");
  assert(aliceReg.exported.publicKey.length > 100, "Alice registered");
  assert(bobReg.exported.publicKey.length > 100, "Bob registered");

  // Alice unwraps her private key
  const alicePriv = await unwrapPrivateKey(
    aliceReg.exported.wrappedPrivateKey,
    "alice-correct-horse-battery-staple",
    aliceReg.exported.pbkdf2Salt,
  );
  assert(alicePriv.type === "private", "Alice unwrapped private key");

  // Wrong password rejected
  let wrongPwThrew = false;
  try {
    await unwrapPrivateKey(
      aliceReg.exported.wrappedPrivateKey,
      "wrong password",
      aliceReg.exported.pbkdf2Salt,
    );
  } catch (e) {
    wrongPwThrew =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "wrong-password";
  }
  assert(wrongPwThrew, "Wrong password rejected with code=wrong-password");

  // Public key roundtrip via the wire format
  const alicePubViaServer = await importPublicKey(
    await exportPublicKey(aliceReg.keys.publicKey),
  );
  const bobPubViaServer = await importPublicKey(bobReg.exported.publicKey);
  assert(alicePubViaServer.type === "public", "Alice's pubkey re-imported");
  assert(bobPubViaServer.type === "public", "Bob's pubkey imported");

  // Encrypt
  const plaintext =
    "Meet me at the dead drop. Bring the rabbit. — A 🥕";
  const payload = await encryptMessage(
    plaintext,
    bobPubViaServer,
    alicePubViaServer,
  );
  assert(payload.ciphertext.length > 0, "Alice encrypted message");
  assert(
    payload.encryptedKey !== payload.encryptedKeyForSelf,
    "encryptedKey ≠ encryptedKeyForSelf (different RSA wrappers)",
    "Alice's RSA wrapper produced a different ciphertext than Bob's",
  );

  // Bob unwraps & decrypts (recipient path)
  const bobPriv = await unwrapPrivateKey(
    bobReg.exported.wrappedPrivateKey,
    "bob-trustno1-but-make-it-strong",
    bobReg.exported.pbkdf2Salt,
  );
  const decryptedByBob = await decryptMessage(payload, bobPriv, false);
  assert(
    decryptedByBob === plaintext,
    "Bob decrypted recipient path",
    `"${decryptedByBob}"`,
  );

  // Alice reads her own sent message (self path)
  const decryptedBySelf = await decryptMessage(payload, alicePriv, true);
  assert(
    decryptedBySelf === plaintext,
    "Alice decrypted self path",
    `"${decryptedBySelf}"`,
  );

  // Tampered ciphertext rejected
  let tamperedThrew = false;
  try {
    const tampered = {
      ...payload,
      ciphertext: payload.ciphertext.slice(0, -4) + "AAAA",
    };
    await decryptMessage(tampered, bobPriv, false);
  } catch (e) {
    tamperedThrew =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "message-unreadable";
  }
  assert(
    tamperedThrew,
    "Tampered ciphertext rejected with code=message-unreadable",
  );

  // Wrong recipient cannot decrypt (Alice tries Bob's recipient ciphertext)
  let wrongRecipientThrew = false;
  try {
    await decryptMessage(payload, alicePriv, false);
  } catch (e) {
    wrongRecipientThrew = true;
    void e;
  }
  assert(
    wrongRecipientThrew,
    "Alice cannot decrypt message intended for Bob",
  );

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(1);
});
