import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tiny grouping primitive for label + input + error message. Shrinks form
 * boilerplate from ~6 lines to 3.
 *
 *   <Field label="Username" error={errors.username?.message} htmlFor="username">
 *     <Input id="username" {...register("username")} />
 *   </Field>
 */

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-bold uppercase tracking-tight"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
