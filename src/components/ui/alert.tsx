import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-3 rounded-base border-2 border-border px-4 py-3 text-sm shadow-brutal-sm",
  {
    variants: {
      variant: {
        info: "bg-card text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, children, ...props }: AlertProps) {
  const icon = variant === "destructive" ? AlertCircleIcon : InformationCircleIcon;
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant, className }))}
      {...props}
    >
      <HugeiconsIcon
        icon={icon}
        size={18}
        strokeWidth={2.5}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 leading-snug font-medium">{children}</div>
    </div>
  );
}
