import { useEffect, useState } from 'react';

/**
 * `value`, but only once it has stopped changing for `delayMs`.
 *
 * <p>For a query keyed on something typed: without it every keystroke is a
 * request, and a request per keystroke on a date field is several requests
 * for dates nobody meant.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
