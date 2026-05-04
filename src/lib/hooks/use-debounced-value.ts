"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` delayed by `delayMs`. Resets the timer on every change,
 * so rapid changes settle to the last value once the user stops typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
