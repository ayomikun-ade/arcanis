"use client";

/**
 * Dev-only crypto smoke test. Exercises the full register → unwrap → encrypt
 * → decrypt loop for two simulated users (Alice and Bob). Useful both as a
 * sanity check during development and as a live demo of E2EE in action.
 *
 * Safe to delete before production.
 */

import { useState } from "react";

import {
  createIdentity,
  decryptMessage,
  encryptMessage,
  exportPublicKey,
  importPublicKey,
  unwrapPrivateKey,
  type IdentityKeys,
} from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Step {
  label: string;
  detail?: string;
  status: "ok" | "fail" | "pending";
}

export default function CryptoTestPage() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setSteps([]);
    const log = (label: string, status: Step["status"], detail?: string) =>
      setSteps((prev) => [...prev, { label, status, detail }]);

    try {
      // --- Register Alice ---
      const alicePassword = "alice-correct-horse-battery-staple";
      const aliceReg = await createIdentity(alicePassword);
      log(
        "Alice registered",
        "ok",
        `pubkey ${aliceReg.exported.publicKey.slice(0, 24)}…`,
      );

      // --- Register Bob ---
      const bobPassword = "bob-trustno1-but-make-it-strong";
      const bobReg = await createIdentity(bobPassword);
      log("Bob registered", "ok");

      // --- Alice "logs in" — unwrap her private key from the wrapped blob ---
      const aliceUnwrappedPriv = await unwrapPrivateKey(
        aliceReg.exported.wrappedPrivateKey,
        alicePassword,
        aliceReg.exported.pbkdf2Salt,
      );
      log("Alice unwrapped her private key", "ok");

      // --- Wrong password should fail noisily ---
      try {
        await unwrapPrivateKey(
          aliceReg.exported.wrappedPrivateKey,
          "wrong password",
          aliceReg.exported.pbkdf2Salt,
        );
        log("Wrong password rejected", "fail", "decryption did not throw");
        throw new Error("Expected wrong-password to throw");
      } catch (e) {
        log(
          "Wrong password rejected",
          "ok",
          e instanceof Error ? e.message : String(e),
        );
      }

      // --- Alice imports Bob's public key from the (simulated) server ---
      const bobPubFromServer = await importPublicKey(bobReg.exported.publicKey);
      log("Alice imported Bob's public key", "ok");

      // --- Alice's own pubkey re-export round-trip ---
      const alicePubFromServer = await importPublicKey(
        await exportPublicKey(aliceReg.keys.publicKey),
      );
      log("Alice's public key re-import round-trip", "ok");

      // --- Alice encrypts a message for Bob ---
      const plaintext =
        "Meet me at the dead drop. Bring the rabbit. — A 🥕";
      const aliceKeys: IdentityKeys = {
        publicKey: alicePubFromServer,
        privateKey: aliceUnwrappedPriv,
      };
      const payload = await encryptMessage(
        plaintext,
        bobPubFromServer,
        aliceKeys.publicKey,
      );
      log(
        "Alice encrypted message",
        "ok",
        `ciphertext ${payload.ciphertext.length} chars (b64)`,
      );

      // --- Bob unwraps his own private key and decrypts ---
      const bobUnwrappedPriv = await unwrapPrivateKey(
        bobReg.exported.wrappedPrivateKey,
        bobPassword,
        bobReg.exported.pbkdf2Salt,
      );
      const decryptedByBob = await decryptMessage(
        payload,
        bobUnwrappedPriv,
        false,
      );
      const bobMatches = decryptedByBob === plaintext;
      log(
        "Bob decrypted (recipient path)",
        bobMatches ? "ok" : "fail",
        bobMatches ? `"${decryptedByBob}"` : `got: "${decryptedByBob}"`,
      );

      // --- Alice can read her own sent message via encryptedKeyForSelf ---
      const decryptedBySelf = await decryptMessage(
        payload,
        aliceKeys.privateKey,
        true,
      );
      const selfMatches = decryptedBySelf === plaintext;
      log(
        "Alice decrypted her own sent message (self path)",
        selfMatches ? "ok" : "fail",
        selfMatches ? `"${decryptedBySelf}"` : `got: "${decryptedBySelf}"`,
      );

      // --- Tampered ciphertext should refuse to decrypt ---
      const tampered = {
        ...payload,
        ciphertext: payload.ciphertext.slice(0, -4) + "AAAA",
      };
      try {
        await decryptMessage(tampered, bobUnwrappedPriv, false);
        log("Tampered ciphertext rejected", "fail", "did not throw");
      } catch (e) {
        log(
          "Tampered ciphertext rejected",
          "ok",
          e instanceof Error ? e.message : String(e),
        );
      }
    } catch (e) {
      log(
        "Unhandled error",
        "fail",
        e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="bg-dotted flex flex-1 flex-col items-center justify-start px-6 py-12">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Crypto roundtrip smoke test</CardTitle>
            <p className="text-sm text-muted-foreground">
              Exercises register → unwrap → encrypt → decrypt for two
              simulated users entirely client-side. All Web Crypto API.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pb-6">
            <Button onClick={run} disabled={running} size="lg">
              {running ? "Running…" : "Run roundtrip"}
            </Button>

            {steps.length > 0 && (
              <ol className="flex flex-col gap-2">
                {steps.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-base border-2 border-border bg-card px-3 py-2 shadow-brutal-sm"
                  >
                    <Badge
                      variant={
                        s.status === "ok"
                          ? "success"
                          : s.status === "fail"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {s.status === "ok"
                        ? "OK"
                        : s.status === "fail"
                          ? "FAIL"
                          : "…"}
                    </Badge>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm">{s.label}</span>
                      {s.detail && (
                        <span className="text-xs font-mono break-all text-muted-foreground">
                          {s.detail}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
