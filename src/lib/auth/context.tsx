"use client";

/**
 * Auth + crypto-session context.
 *
 * Holds, in priority order:
 *   - the current state (loading | anonymous | needs-unlock | authenticated)
 *   - the in-memory access token (a ref so rotation doesn't re-render)
 *   - the unwrapped RSA CryptoKey pair (memory only; private key non-extractable)
 *   - a single ApiClient bound to the read-through token + refresh function
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
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  const accessTokenRef = useRef<string | null>(null);

  // Stable refresh function — doesn't depend on any state, only mutates the
  // accessTokenRef. Safe to capture in the ApiClient constructor below.
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) {
        accessTokenRef.current = null;
        return null;
      }
      const body = (await res.json()) as { access_token: string };
      accessTokenRef.current = body.access_token;
      return body.access_token;
    } catch {
      accessTokenRef.current = null;
      return null;
    }
  }, []);

  const client = useMemo(
    () =>
      new ApiClient({
        getAccessToken: () => accessTokenRef.current,
        refreshAccessToken,
      }),
    [refreshAccessToken],
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
      const newToken = await refreshAccessToken();
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
  }, [refreshAccessToken]);

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
      accessTokenRef.current = data.access_token;
      await savePersistedIdentity({
        user: data.user,
        wrappedPrivateKey: exported.wrappedPrivateKey,
        pbkdf2Salt: exported.pbkdf2Salt,
        publicKey: exported.publicKey,
      });
      setState({ status: "authenticated", user: data.user, keys });
    },
    [],
  );

  const login = useCallback(async (form: LoginFormData): Promise<void> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) throw await asProxyError(res, "Login failed");
    const data = (await res.json()) as AuthProxyResponse;
    accessTokenRef.current = data.access_token;
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
  }, []);

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
    const token = accessTokenRef.current;
    accessTokenRef.current = null;
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // best-effort — local sign-out continues regardless
    }
    await clearPersistedIdentity();
    setState({ status: "anonymous" });
  }, []);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

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
