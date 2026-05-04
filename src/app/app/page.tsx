"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  LockIcon,
  MessageMultiple01Icon,
} from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { useAuth, type AuthState } from "@/lib/auth";

/**
 * Empty state shown in the main pane when no conversation is selected.
 * On mobile this isn't rendered (the sidebar takes the whole screen).
 */

export default function AppHome() {
  const { state } = useAuth();
  const me =
    state.status === "authenticated"
      ? (state as Extract<AuthState, { status: "authenticated" }>).user
      : null;

  return (
    <div className="bg-dotted flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="grid size-20 place-items-center rounded-base border-2 border-border bg-primary text-primary-foreground shadow-brutal">
        <HugeiconsIcon
          icon={MessageMultiple01Icon}
          size={36}
          strokeWidth={2}
        />
      </div>
      <h2 className="mt-6 text-3xl font-black uppercase tracking-tight">
        {me ? `Welcome, ${me.display_name}` : "Welcome"}
      </h2>
      <p className="mt-2 max-w-md text-sm font-medium text-muted-foreground">
        Pick a conversation on the left, or search for someone to start a
        new encrypted thread.
      </p>
      <Badge variant="success" className="mt-6 text-xs">
        <HugeiconsIcon icon={LockIcon} size={12} strokeWidth={2.5} />
        Your private key is unwrapped on this device only
      </Badge>
    </div>
  );
}
