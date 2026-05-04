"use client";

/**
 * Authenticated home — placeholder until Stage 5 lands the conversation
 * shell. Confirms the full auth + crypto loop works end-to-end.
 */

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";

import { AuthGate } from "@/components/auth/auth-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth, type AuthState } from "@/lib/auth";

export default function AppHomePage() {
  return (
    <AuthGate expects="authenticated">
      <AppHome />
    </AuthGate>
  );
}

function AppHome() {
  const { state, logout } = useAuth();
  const router = useRouter();

  const session =
    state.status === "authenticated"
      ? (state as Extract<AuthState, { status: "authenticated" }>)
      : null;
  if (!session) return null;

  return (
    <main className="bg-dotted flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Badge variant="success" className="self-start">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={12}
              strokeWidth={2.5}
            />
            Signed in
          </Badge>
          <CardTitle className="pt-2">
            Hello, {session.user.display_name} 👋
          </CardTitle>
          <CardDescription>
            Your private key is unwrapped and held in memory only. The server
            sees nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-6">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-bold uppercase text-xs">Username</dt>
            <dd className="font-mono">{session.user.username}</dd>
            <dt className="font-bold uppercase text-xs">User id</dt>
            <dd className="font-mono break-all text-xs">{session.user.id}</dd>
          </dl>
          <p className="text-sm text-muted-foreground pt-2">
            Stage 5 will replace this page with the conversation list and
            chat shell.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
          >
            <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={2} />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
