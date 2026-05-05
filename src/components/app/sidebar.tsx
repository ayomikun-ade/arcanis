"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InboxIcon,
  Logout01Icon,
  MessageAdd01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ConnectionStatus } from "@/components/app/connection-status";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useConversations, useUserSearch } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type {
  ConversationSummary,
  UserSummary,
} from "@/lib/api";

export function Sidebar({ className }: { className?: string }) {
  const { state, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 1000);
  const isSearching = debouncedQuery.trim().length > 0;

  const conversations = useConversations();
  const search = useUserSearch(debouncedQuery);

  const me =
    state.status === "authenticated" ? state.user : null;

  const activeUserId = pathname.startsWith("/app/conversations/")
    ? decodeURIComponent(pathname.split("/")[3] ?? "")
    : null;

  return (
    <aside
      className={cn(
        "flex w-full flex-col border-r-2 border-border bg-card md:w-80",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-3">
        <Link href="/app" className="flex items-center gap-2">
          <h2 className="text-xl font-black uppercase tracking-tight">
            Arcanis
          </h2>
          <Badge variant="success" className="text-[10px]">
            E2EE
          </Badge>
        </Link>
        <ConnectionStatus />
      </div>

      {/* Search */}
      <div className="relative px-3 pt-3 pb-2">
        <HugeiconsIcon
          icon={Search01Icon}
          size={18}
          strokeWidth={2}
          className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find someone to message…"
          aria-label="Search users"
          className="pl-10"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

      {/* List body */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isSearching ? (
          <SearchResults
            query={debouncedQuery}
            isLoading={search.isLoading || search.isFetching}
            results={search.data ?? []}
            error={search.error}
            activeUserId={activeUserId}
            onSelect={() => setQuery("")}
          />
        ) : (
          <ConversationList
            isLoading={conversations.isLoading}
            data={conversations.data ?? []}
            error={conversations.error}
            activeUserId={activeUserId}
          />
        )}
      </div>

      {/* Profile strip */}
      {me && (
        <div className="flex items-center gap-3 border-t-2 border-border p-3">
          <Avatar name={me.display_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{me.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{me.username}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => router.replace("/login"));
            }}
            aria-label="Sign out"
            className="grid place-items-center size-9 rounded-base border-2 border-border bg-card hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-brutal-sm"
          >
            <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} />
          </button>
        </div>
      )}
    </aside>
  );
}

/* ───────────────────── Conversation list ───────────────────── */

function ConversationList({
  isLoading,
  data,
  error,
  activeUserId,
}: {
  isLoading: boolean;
  data: ConversationSummary[];
  error: Error | null;
  activeUserId: string | null;
}) {
  if (isLoading) return <ListSkeleton />;
  if (error)
    return (
      <p className="px-3 py-2 text-sm text-destructive font-medium">
        Couldn&apos;t load conversations.
      </p>
    );
  if (data.length === 0)
    return (
      <EmptyHint
        icon={<HugeiconsIcon icon={InboxIcon} size={28} strokeWidth={2} />}
        title="No conversations yet"
        body="Search for someone above to start your first encrypted thread."
      />
    );
  return (
    <ul className="flex flex-col gap-1 py-1">
      {data.map((c) => (
        <li key={c.user_id}>
          <ConversationRow row={c} active={c.user_id === activeUserId} />
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({
  row,
  active,
}: {
  row: ConversationSummary;
  active: boolean;
}) {
  return (
    <Link
      href={`/app/conversations/${row.user_id}`}
      className={cn(
        "flex items-center gap-3 rounded-base px-2 py-2 transition-colors",
        active
          ? "bg-primary text-primary-foreground border-2 border-border shadow-brutal-sm"
          : "hover:bg-muted/60 border-2 border-transparent",
      )}
    >
      <Avatar name={row.display_name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-bold text-sm">{row.display_name}</span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-tight opacity-70">
            {formatRelative(row.last_message_at)}
          </span>
        </div>
        <p className="truncate text-xs opacity-70">@{row.username}</p>
      </div>
    </Link>
  );
}

/* ───────────────────── Search results ───────────────────── */

function SearchResults({
  query,
  isLoading,
  results,
  error,
  activeUserId,
  onSelect,
}: {
  query: string;
  isLoading: boolean;
  results: UserSummary[];
  error: Error | null;
  activeUserId: string | null;
  onSelect: () => void;
}) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner size={16} /> Searching…
      </div>
    );
  if (error)
    return (
      <p className="px-3 py-2 text-sm text-destructive font-medium">
        Search failed. Try again.
      </p>
    );
  if (results.length === 0)
    return (
      <EmptyHint
        icon={<HugeiconsIcon icon={Search01Icon} size={28} strokeWidth={2} />}
        title="No matches"
        body={`Nobody on Arcanis matches "${query}".`}
      />
    );
  return (
    <ul className="flex flex-col gap-1 py-1">
      {results.map((u) => (
        <li key={u.id}>
          <UserSearchRow
            user={u}
            active={u.id === activeUserId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

function UserSearchRow({
  user,
  active,
  onSelect,
}: {
  user: UserSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={`/app/conversations/${user.id}`}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-base px-2 py-2 transition-colors",
        active
          ? "bg-primary text-primary-foreground border-2 border-border shadow-brutal-sm"
          : "hover:bg-muted/60 border-2 border-transparent",
      )}
    >
      <Avatar name={user.display_name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-sm">{user.display_name}</p>
        <p className="truncate text-xs opacity-70">@{user.username}</p>
      </div>
      <HugeiconsIcon
        icon={MessageAdd01Icon}
        size={16}
        strokeWidth={2}
        className="opacity-60"
      />
    </Link>
  );
}

/* ───────────────────── Helpers ───────────────────── */

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-2 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-10 shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyHint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-base border-2 border-border bg-accent text-accent-foreground shadow-brutal-sm">
        {icon}
      </div>
      <p className="font-bold">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 7 * 86_400) return `${Math.floor(diffSec / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
