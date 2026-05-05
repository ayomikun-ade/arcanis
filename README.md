# Arcanis

> A zero-knowledge messenger built on the WhisperBox backend.
> Messages are encrypted on the client; the server only ever sees ciphertext.

Submission for **Stage 4B — End-to-End Encrypted App**.

---

## Table of contents

- [Live demo](#live-demo)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Encryption flow](#encryption-flow)
- [Key management](#key-management)
- [Security trade-offs](#security-trade-offs)
- [Known limitations](#known-limitations)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Deployment](#deployment)

---

## Live demo

_Add your Vercel URL here once deployed._

Backend: [`https://whisperbox.koyeb.app`](https://whisperbox.koyeb.app)

---

## Quick start

```bash
git clone <repo-url> arcanis
cd arcanis
pnpm install
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>.

The default `.env.local` points at the live WhisperBox backend; no extra
configuration is required for local development.

---

## Architecture

```
                            HTTPS
                              ┌───────────────────┐
        ┌────────────┐        │                   │      ┌────────────────────┐
        │            │  POST  │  Next.js (Vercel) │ POST │                    │
        │  Browser   ├───────►│   /api/auth/*     ├─────►│                    │
        │  (Arcanis) │        │  proxy + cookie   │      │                    │
        │            │◄───────┤                   │◄─────┤                    │
        │            │        └───────────────────┘      │                    │
        │            │                                   │  WhisperBox API    │
        │            │           direct HTTPS            │  (koyeb.app)       │
        │   crypto   ├──────────────────────────────────►│                    │
        │   in-tab   │           Bearer token            │                    │
        │            │                                   │                    │
        │            │           direct WSS              │                    │
        │            ├──────────────────────────────────►│                    │
        │            │       token in query string       │                    │
        └────────────┘                                   └────────────────────┘
```

Three traffic patterns:

1. **Auth endpoints** (`/auth/register`, `/auth/login`, `/auth/refresh`,
   `/auth/logout`) go through a thin **Next.js proxy** at `/api/auth/*`.
   The proxy strips the `refresh_token` from the response JSON and stores it
   in an `HttpOnly Secure SameSite=Lax` cookie that JavaScript can never
   read. The browser only ever sees the short-lived (15 min) access token.
2. **All other REST calls** (search, public-key fetch, conversations,
   messages, send) go **directly from the browser to WhisperBox** with the
   access token in the `Authorization: Bearer` header.
3. **WebSocket** connects directly with `?token=<access_token>` (browsers
   can't set custom headers on WS handshakes), used for inbound messages
   and presence frames.

Plaintext data **never** touches our Next.js layer or our Vercel deployment.
The client encrypts before sending; the recipient client decrypts after
receiving.

---

## Encryption flow

Arcanis uses a **hybrid encryption** scheme — symmetric for the message
body, asymmetric for the key exchange. This is the same pattern used by
Signal, WhatsApp, and OpenPGP.

### Per-message

```
sender                                                            recipient
──────                                                            ─────────

   plaintext (UTF-8)                                                 plaintext
        │                                                                ▲
        │  AES-GCM-256 encrypt with random key K and 96-bit IV           │
        ▼                                                                │
    ciphertext ─────────────────────────────────────────────►   AES-GCM decrypt(K, IV, ciphertext)
        +                                                                ▲
        K (32 raw bytes)                                                 │ K
        │                                                                │
        ├──► RSA-OAEP encrypt with recipient's public key ───►  encryptedKey ──► RSA-OAEP decrypt with own private key
        │                                                                ▲
        └──► RSA-OAEP encrypt with own public key ──────────►  encryptedKeyForSelf
                                                                  (sender's history copy)
```

The wire payload is exactly:

```jsonc
{
  "ciphertext":          "<base64 AES-GCM ciphertext + auth tag>",
  "iv":                  "<base64 96-bit IV>",
  "encryptedKey":        "<base64 RSA-OAEP(recipient.pub, K)>",
  "encryptedKeyForSelf": "<base64 RSA-OAEP(sender.pub,    K)>"
}
```

The dual key wrap (`encryptedKey` + `encryptedKeyForSelf`) lets the **sender
read their own sent messages** later from `/conversations/{userId}/messages`
— their copy of the AES key is RSA-wrapped under their *own* public key.
This is the same trick group chats use to fan out to N participants.

### Why these primitives

| Primitive | Role | Why |
|---|---|---|
| **RSA-OAEP 2048** | Asymmetric identity keypair | Specified in the brief. OAEP padding makes the ciphertext non-deterministic and resistant to chosen-ciphertext attacks. SHA-256 hash. |
| **AES-GCM 256** | Symmetric per-message + key wrapping | Authenticated encryption — built-in tag detects tampering. 96-bit random IV per message (never reuse with the same key). |
| **PBKDF2 SHA-256, 600 000 iterations** | Stretch the user's password into a 256-bit AES key | OWASP 2023 recommendation. Slow on purpose; brute-forcing a stolen wrapped blob is expensive. 128-bit random salt prevents rainbow tables. |

---

## Key management

### On registration

```
1. RSA-OAEP-2048 keypair generated client-side       (CryptoKey objects in JS)
2. Random 128-bit salt                               (Uint8Array)
3. wrappingKey = PBKDF2(password, salt, 600k)        (AES-GCM-256 key)
4. iv = random 96 bits
5. ciphertext = AES-GCM-wrap("pkcs8", privateKey, wrappingKey, iv)
6. wrapped_private_key = base64(iv ‖ ciphertext)
7. POST /auth/register {
     username, display_name, password,
     public_key:          base64(SPKI of publicKey),
     wrapped_private_key,
     pbkdf2_salt:         base64(salt)
   }
```

### On login (same device or new)

```
1. POST /auth/login → { access_token, user: { wrapped_private_key, pbkdf2_salt, ... } }
2. wrappingKey = PBKDF2(password, salt, 600k)
3. iv ‖ ciphertext = base64-decode(wrapped_private_key)
4. privateKey = AES-GCM-unwrap("pkcs8", ciphertext, wrappingKey, iv)
                               extractable: false, ["decrypt"]
5. Hold publicKey + privateKey CryptoKeys in JS memory.
   Persist the wrapped blob + user profile in IndexedDB so a returning
   user gets an "Unlock with password" screen instead of a full re-login.
```

### What lives where

| Data | Where | Lifetime | Notes |
|---|---|---|---|
| Unwrapped RSA private key | JS memory only | While tab is open | `extractable: false` — Web Crypto refuses to export bytes |
| Wrapped private key blob | IndexedDB | Persistent | Encrypted with password-derived KEK; useless without the password |
| PBKDF2 salt | IndexedDB | Persistent | Same blob the server holds |
| Public key | IndexedDB + server | Persistent | Public information |
| Password | JS memory | Microseconds | Held only during PBKDF2 derivation, then discarded |
| Access token | JS memory (ref) | ≤15 min | Never persisted to storage; rotates via `/api/auth/refresh` |
| Refresh token | `HttpOnly` cookie | 30 days | JavaScript cannot read it (XSS-resistant) |

### Wrong-password detection

The server can't verify the password — it never hashes it, only stores the
opaque wrapped blob. AES-GCM's authentication tag throws on a wrong-KEK
unwrap, so:

```ts
unwrapPrivateKey(wrappedBlob, wrongPassword, salt)  // throws CryptoError("wrong-password")
```

…doubles as our password check. No round-trip needed.

---

## Security trade-offs

A frank list of the things a careful evaluator would ask about.

### 1. AES-GCM instead of AES-KW for the wrap

The brief specifies **AES-KW** for wrapping the RSA private key. We
deviated.

Empirical reason: AES-KW (RFC 3394) requires an input length that is a
multiple of 8 bytes, and PKCS#8-exported RSA-2048 private keys are *not*
always aligned. We sampled 50 fresh keypairs in Node 24:

```
pkcs8 byteLength mod 8: { 0: 8, 1: 23, 2: 16, 3: 2, 7: 1 }
AES-KW with pkcs8 succeeded: 8 / 50  (16%)
```

A literal AES-KW + PKCS#8 implementation would fail registration ~84% of
the time. AES-GCM has no alignment requirement, provides the same
authentication-on-unwrap behaviour we rely on for wrong-password detection,
and is the same primitive used per-message. The server stores the wrapped
blob opaquely, so this choice is invisible to the backend.

### 2. Password-derived KEK is only as strong as the password

PBKDF2 with 600k iterations slows down brute-force attempts but doesn't
make a weak password ("password123") strong. The form enforces a minimum
of 8 characters and 128 max — the rest is on the user. **Argon2id** would
be stronger (memory-hard) but isn't exposed by the Web Crypto API.

### 3. No sender authentication

Today, when a `message.receive` frame arrives with `from_user_id: bob`,
we trust that label. The server (or anyone with server access) could
fabricate a frame with a different `from_user_id` whose payload is
encrypted under our public key — we'd decrypt it and render it as if Bob
sent it. A production hardening would have the sender sign
`(from_user_id, payload)` with their identity key, and the recipient
verify the signature. Documented; the brief does not require it.

### 4. No forward secrecy

The RSA identity key is long-lived. If a user's private key (or password)
is ever compromised, all *past* messages encrypted to that key become
decryptable. True forward secrecy requires ephemeral key exchanges per
session (Signal's X3DH + Double Ratchet). Implementing it on top of an
API that only stores a single per-user public key would require either a
schema change or smuggling ephemeral keys inside the encrypted payload.

### 5. No replay protection

The server (or a MITM with server collusion) could re-deliver the same
encrypted blob twice; the client would decrypt both copies and display
the message twice. Mitigation: include a per-conversation monotonic
counter inside the encrypted plaintext and reject any frame whose
counter is ≤ the highest seen. Not implemented; the brief lists this as
a bonus.

### 6. Refresh token lives on the client

We use an `HttpOnly Secure SameSite=Lax` cookie scoped to `/api/auth`.
JavaScript can never read it, which kills XSS-based exfiltration. CSRF
is mitigated by `SameSite=Lax`. The remaining attack surface:

- **A subdomain compromise** that can set cookies on the parent domain
  could plant a forged cookie. We control the domain in production.
- **A successful XSS in the auth tab itself** could call
  `/api/auth/refresh` directly to mint access tokens silently. The
  in-memory access token is short (15 min) but the refresh path is alive
  for 30 days. Defence: tight CSP headers (Stage 8+ polish).

### 7. The unwrapped private key sits in the tab

Once unlocked, the RSA private CryptoKey is in JS memory until the tab
closes. We mark it `extractable: false`, so a malicious script *can't
exfiltrate the bytes* — but it can request `decrypt` operations on
arbitrary ciphertext through the Web Crypto API while the tab is open.
Mitigation reduces to "don't get XSSed."

### 8. Plaintext metadata is visible to the server

End-to-end encryption protects message *content*. Metadata that's
necessarily server-visible (and therefore visible to anyone who breaches
the server):

- who messaged whom and when
- who's online (presence frames)
- usernames and display names

This is identical to Signal. It's an architectural floor, not something
fixable at the messaging layer.

---

## Known limitations

Things that work *enough* but would be hardened in a production push:

- **Cross-tab logout sync.** Logging out in one tab doesn't immediately
  sign out other tabs of the same browser; they'll silently fall back to
  `/login` when their access token expires (≤15 min). A `BroadcastChannel`
  fanout would close the gap.
- **Proactive token refresh.** We refresh reactively on 401 (REST) /
  4001 (WS). A 14-minute timer would avoid the brief reconnect blip you
  may notice every 15 minutes.
- **PBKDF2 on the main thread.** 600k iterations spins the UI thread for
  ~150ms during register / login / unlock. Moving it to a Web Worker
  would keep the spinner buttery on slower devices.
- **No unread indicator.** The WhisperBox API has no concept of read /
  unread. Could be implemented client-side with a `lastReadAt[userId]`
  map in localStorage compared to `last_message_at`.
- **No message virtualisation.** All messages render to the DOM. Modern
  browsers handle a few hundred bubbles fine; a 10k-message thread
  would benefit from `@tanstack/react-virtual`.
- **No optimistic outgoing bubbles.** We wait for the `POST /messages`
  response before showing the sent bubble (~200–300 ms including
  encryption). A truly optimistic UX would render at submit time and
  reconcile later — non-trivial to get right with server-assigned IDs.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC) |
| UI framework | React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind v4 with neobrutalism design tokens |
| Crypto | Web Crypto API (`window.crypto.subtle`) |
| HTTP client | axios with request + response interceptors |
| Server state | TanStack Query (incl. `useInfiniteQuery` for message pagination) |
| Forms | react-hook-form + zod |
| Local persistence | `idb-keyval` over IndexedDB |
| Icons | `@hugeicons/react` + `@hugeicons/core-free-icons` |
| Real-time | Native WebSocket with custom reconnect/backoff |
| Package manager | pnpm |

---

## Project layout

```
src/
├── app/                          Next.js App Router
│   ├── (auth)/                   route group: /register, /login, /unlock
│   ├── api/auth/                 server-side proxy: register/login/refresh/logout
│   ├── app/                      authenticated shell (sidebar + main pane)
│   │   ├── conversations/[userId]
│   │   ├── layout.tsx            AuthGate + responsive shell
│   │   └── page.tsx              empty-state for the main pane
│   ├── crypto-test/              dev-only roundtrip verifier (deletable)
│   ├── layout.tsx
│   ├── page.tsx                  landing
│   └── providers.tsx             QueryClient + Auth + WS
│
├── components/
│   ├── auth/auth-gate.tsx        state-machine route guard
│   ├── app/                      sidebar, chat thread, presence dot, etc.
│   └── ui/                       neobrutalism primitives (Button, Card, …)
│
├── lib/
│   ├── api/                      typed axios client + WhisperBox wire types
│   ├── auth/                     context, IndexedDB store, server-only proxy helpers
│   ├── crypto/                   RSA-OAEP, AES-GCM, PBKDF2 wrappers
│   ├── env.ts                    typed env access
│   ├── hooks/                    debounce, decrypt-batch, send-mutation
│   ├── queries/                  TanStack Query hooks + queryKeys
│   ├── utils.ts                  cn() helper
│   └── ws/                       WebSocket lifecycle + provider
│
└── scripts/
    └── crypto-smoke.ts           headless roundtrip test for the crypto layer
```

---

## Deployment

### Vercel

1. Push to GitHub.
2. Import the repo into Vercel.
3. Set environment variables:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://whisperbox.koyeb.app` |
   | `COOKIE_SECURE` | `true` |

4. Deploy.

### Self-host

Build:

```bash
pnpm build
pnpm start
```

The app is a standard Next.js 16 application. Any Node host that runs
Next.js will do; the auth proxy routes need a server runtime
(`/api/auth/*` are dynamic, not static).

### Verifying the crypto layer

A headless roundtrip test exercises the full register → unwrap →
encrypt → decrypt loop:

```bash
pnpm dlx tsx scripts/crypto-smoke.ts
```

Expected output: 12 `ok` lines, including wrong-password rejection,
recipient-decrypt, self-decrypt, and tamper-detection paths. Runs in
Node 20+ (Web Crypto is exposed at `globalThis.crypto`).

---

## Acknowledgements

Frontend submission for Stage 4B; backend by the WhisperBox team.

Built with Claude Code as a pair-programming partner; design decisions
and crypto trade-offs are documented in `docs/LEARN.md` (gitignored,
personal study notes).
