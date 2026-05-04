import { cn } from "@/lib/utils";

/**
 * Initial-letter avatar with a deterministic colour picked from the name.
 * Same person gets the same colour every time.
 */

const PALETTES = [
  "bg-primary",
  "bg-secondary",
  "bg-accent",
  "bg-success",
  "bg-destructive",
] as const;

function paletteFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[h % PALETTES.length]!;
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-14 text-xl",
} as const;

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-base border-2 border-border font-black uppercase shadow-brutal-sm select-none",
        paletteFor(name),
        "text-foreground",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initial}
    </div>
  );
}
