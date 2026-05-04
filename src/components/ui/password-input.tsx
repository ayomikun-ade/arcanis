"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { Input } from "./input";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput({ className, ...props }, ref) {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={revealed ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide password" : "Show password"}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-8 rounded-base text-foreground hover:bg-muted transition-colors"
      >
        <HugeiconsIcon
          icon={revealed ? ViewOffIcon : ViewIcon}
          size={18}
          strokeWidth={2}
        />
      </button>
    </div>
  );
});
