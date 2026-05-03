import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-base border-2 border-border bg-card px-3 py-1 font-medium text-foreground shadow-brutal-sm",
        "placeholder:text-muted-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "transition-all outline-none",
        "focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
