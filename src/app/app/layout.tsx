"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthGate } from "@/components/auth/auth-gate";
import { Sidebar } from "@/components/app/sidebar";
import { cn } from "@/lib/utils";

/**
 * Authenticated app shell.
 *
 *   ┌────────────────────────────────────┐
 *   │ Sidebar │ Main pane                │
 *   │ (320px) │ (flex-1)                 │
 *   └────────────────────────────────────┘
 *
 * Mobile: only one pane is visible at a time.
 *   - On /app          → sidebar full width
 *   - On /app/conversations/X → main pane full width (back button → /app)
 */

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate expects="authenticated">
      <Shell>{children}</Shell>
    </AuthGate>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onConversation = pathname.startsWith("/app/conversations/");

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        className={cn(
          "shrink-0",
          // Mobile: hide when a conversation is open
          onConversation ? "hidden md:flex" : "flex",
        )}
      />
      <section
        className={cn(
          "flex-1 flex flex-col overflow-hidden",
          // Mobile: hide the empty-pane when nothing's selected
          onConversation ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </section>
    </div>
  );
}
