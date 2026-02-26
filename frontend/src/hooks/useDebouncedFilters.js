import { useRef, useEffect } from 'react';
import useDebouncedValue from './useDebouncedValue';

export default function useDebouncedFilters(filters, delay = 400) {
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const debouncedFilters = useDebouncedValue(filters, delay);

  return { filtersRef, debouncedFilters };
}
