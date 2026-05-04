import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-base border-2 border-border bg-muted/60 animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
