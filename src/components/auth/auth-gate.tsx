"use client";

/**
 * Route-level state gate.
 *
 * Wrap a page in <AuthGate expects="anonymous"> and the gate will
 * client-redirect to the appropriate page if the auth state doesn't
 * match. While the auth state machine is still bootstrapping (status
 * === "loading"), it shows a centered spinner instead of flashing the
 * wrong page.
 *
 * Mapping for off-state redirects:
 *   authenticated  → /app
 *   needs-unlock   → /unlock
 *   anonymous      → /login
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth, type AuthState } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";

type StateKey = AuthState["status"];

const REDIRECT_TARGETS: Record<Exclude<StateKey, "loading">, string> = {
  authenticated: "/app",
  "needs-unlock": "/unlock",
  anonymous: "/login",
};

interface AuthGateProps {
  expects: Exclude<StateKey, "loading">;
  children: ReactNode;
}

export function AuthGate({ expects, children }: AuthGateProps) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "loading" || state.status === expects) return;
    router.replace(REDIRECT_TARGETS[state.status]);
  }, [state.status, expects, router]);

  if (state.status !== expects) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
        <Spinner size={28} />
      </div>
    );
  }
  return <>{children}</>;
}
