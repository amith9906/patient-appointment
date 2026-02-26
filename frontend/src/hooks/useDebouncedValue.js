import { useState, useEffect } from 'react';

const DEFAULT_DEBOUNCE_MS = 400;

export default function useDebouncedValue(value, delay = DEFAULT_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
