import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[40px] w-full rounded-base border-2 border-border bg-card px-3 py-2 font-medium text-foreground shadow-brutal-sm",
        "placeholder:text-muted-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "transition-all outline-none resize-none",
        "focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
