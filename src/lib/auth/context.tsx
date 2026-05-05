"use client";

/**
 * Auth + crypto-session context.
 *
 * Holds, in priority order:
 *   - the current state (loading | anonymous | needs-unlock | authenticated)
 *   - the unwrapped RSA CryptoKey pair (memory only; private key non-extractable)
 *   - a single ApiClient instance — the *client* owns the access token
 *     internally so the React layer never has a token-holding ref flowing
 *     into a render-time constructor (React 19 flags that as ref-during-render).
 *
 * State transitions:
 *
 *   mount                 → loading
 *   no saved blob         → anonymous
 *   saved blob, refresh ok → needs-unlock
 *   saved blob, refresh 401 → anonymous (after clearing blob)
 *
 *   register(form)        → authenticated
 *   login(form)           → authenticated
 *   unlock(password)      → authenticated   (only valid from needs-unlock)
 *   logout()              → anonymous
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api";
import type {
  AuthResponse,
  RegisterRequest,
  UserProfile,
} from "@/lib/api/types";
import {
  createIdentity,
  importPublicKey,
  unwrapPrivateKey,
  type IdentityKeys,
} from "@/lib/crypto";

import {
  clearPersistedIdentity,
  loadPersistedIdentity,
  savePersistedIdentity,
  type PersistedIdentity,
} from "./storage";

export interface RegisterFormData {
  username: string;
  display_name: string;
  password: string;
}

export interface LoginFormData {
  username: string;
  password: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "needs-unlock"; persisted: PersistedIdentity }
  | { status: "authenticated"; user: UserProfile; keys: IdentityKeys };

export interface AuthContextValue {
  state: AuthState;
  client: ApiClient;
  /** Read-through access to the current in-memory access token. */
  getAccessToken: () => string | null;
  /** Force a refresh; returns the new token or null on failure. */
  refreshAccessToken: () => Promise<string | null>;
  register: (form: RegisterFormData) => Promise<void>;
  login: (form: LoginFormData) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Public response from our /api/auth/register and /api/auth/login proxies. */
type AuthProxyResponse = Omit<AuthResponse, "refresh_token">;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  // Lazy-init: one ApiClient instance per signed-in browser tab. The client
  // owns the access token internally; we push values via setAccessToken().
  const [client] = useState(() => new ApiClient());
  const queryClient = useQueryClient();

  // Stable wrappers around the client's token plumbing. Used by WsProvider
  // (which needs to read the latest access token at WS-handshake time and
  // refresh on a 4001 close).
  const getAccessToken = useCallback(
    () => client.getAccessToken(),
    [client],
  );
  const refreshAccessToken = useCallback(
    () => client.refresh(),
    [client],
  );

  /* ────────── mount bootstrap ────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = await loadPersistedIdentity();
      if (cancelled) return;
      if (!persisted) {
        setState({ status: "anonymous" });
        return;
      }
      // We have a saved blob; try to revive an access token from the cookie.
      const newToken = await client.refresh();
      if (cancelled) return;
      if (newToken) {
        setState({ status: "needs-unlock", persisted });
      } else {
        await clearPersistedIdentity();
        setState({ status: "anonymous" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  /* ────────── operations ────────── */

  const register = useCallback(
    async (form: RegisterFormData): Promise<void> => {
      const { keys, exported } = await createIdentity(form.password);
      const body: RegisterRequest = {
        username: form.username,
        display_name: form.display_name,
        password: form.password,
        public_key: exported.publicKey,
        wrapped_private_key: exported.wrappedPrivateKey,
        pbkdf2_salt: exported.pbkdf2Salt,
      };
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await asProxyError(res, "Registration failed");
      const data = (await res.json()) as AuthProxyResponse;
      client.setAccessToken(data.access_token);
      await savePersistedIdentity({
        user: data.user,
        wrappedPrivateKey: exported.wrappedPrivateKey,
        pbkdf2Salt: exported.pbkdf2Salt,
        publicKey: exported.publicKey,
      });
      setState({ status: "authenticated", user: data.user, keys });
    },
    [client],
  );

  const login = useCallback(
    async (form: LoginFormData): Promise<void> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw await asProxyError(res, "Login failed");
      const data = (await res.json()) as AuthProxyResponse;
      client.setAccessToken(data.access_token);
      const [privateKey, publicKey] = await Promise.all([
        unwrapPrivateKey(
          data.user.wrapped_private_key,
          form.password,
          data.user.pbkdf2_salt,
        ),
        importPublicKey(data.user.public_key),
      ]);
      await savePersistedIdentity({
        user: data.user,
        wrappedPrivateKey: data.user.wrapped_private_key,
        pbkdf2Salt: data.user.pbkdf2_salt,
        publicKey: data.user.public_key,
      });
      setState({
        status: "authenticated",
        user: data.user,
        keys: { publicKey, privateKey },
      });
    },
    [client],
  );

  const unlock = useCallback(
    async (password: string): Promise<void> => {
      if (state.status !== "needs-unlock") {
        throw new Error("Cannot unlock — no saved identity");
      }
      const { persisted } = state;
      const [privateKey, publicKey] = await Promise.all([
        unwrapPrivateKey(
          persisted.wrappedPrivateKey,
          password,
          persisted.pbkdf2Salt,
        ),
        importPublicKey(persisted.publicKey),
      ]);
      setState({
        status: "authenticated",
        user: persisted.user,
        keys: { publicKey, privateKey },
      });
    },
    [state],
  );

  const logout = useCallback(async (): Promise<void> => {
    const token = client.getAccessToken();
    client.setAccessToken(null);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // best-effort — local sign-out continues regardless
    }
    await clearPersistedIdentity();
    // Wipe all server-state cache so the next user on this device
    // doesn't briefly see the previous user's conversations / messages.
    queryClient.clear();
    setState({ status: "anonymous" });
  }, [client, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      client,
      getAccessToken,
      refreshAccessToken,
      register,
      login,
      unlock,
      logout,
    }),
    [
      state,
      client,
      getAccessToken,
      refreshAccessToken,
      register,
      login,
      unlock,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Read a `{ detail }` error body from a 4xx/5xx proxy response. */
async function asProxyError(res: Response, fallback: string): Promise<Error> {
  let detail = `${fallback} (${res.status})`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    // non-JSON body — keep fallback
  }
  return new Error(detail);
}
