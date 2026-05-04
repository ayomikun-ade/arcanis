"use client";

import { cn } from "@/lib/utils";
import { useWs } from "@/lib/ws/context";

const STYLES = {
  connected: { dot: "bg-success", label: "Live" },
  connecting: { dot: "bg-accent animate-pulse", label: "Connecting…" },
  reconnecting: { dot: "bg-accent animate-pulse", label: "Reconnecting…" },
  disconnected: { dot: "bg-muted-foreground", label: "Offline" },
} as const;

interface ConnectionStatusProps {
  className?: string;
  /** When true, render only the dot. When false, also show a text label. */
  compact?: boolean;
}

export function ConnectionStatus({
  className,
  compact = true,
}: ConnectionStatusProps) {
  const { status } = useWs();
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 select-none",
        className,
      )}
      title={style.label}
      aria-label={style.label}
    >
      <span
        className={cn(
          "block size-2 rounded-full border border-border",
          style.dot,
        )}
      />
      {!compact && (
        <span className="text-[10px] font-bold uppercase tracking-tight">
          {style.label}
        </span>
      )}
    </span>
  );
}
