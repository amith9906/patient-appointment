import React, { useEffect, useId, useMemo, useState } from 'react';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  className = '',
  placeholder = 'Search...',
  disabled = false,
  allowEmpty = true,
  emptyLabel = 'Select',
  ...inputProps
}) {
  const listId = useId();
  const normalized = useMemo(
    () => (options || [])
      .filter((o) => o && o.value !== undefined && o.value !== null)
      .map((o) => ({ value: String(o.value), label: String(o.label ?? o.value) })),
    [options]
  );

  const selectedLabel = useMemo(() => {
    const v = String(value ?? '');
    return normalized.find((o) => o.value === v)?.label || '';
  }, [normalized, value]);

  const [text, setText] = useState(selectedLabel);

  useEffect(() => {
    setText(selectedLabel);
  }, [selectedLabel]);

  const emitValue = (nextText) => {
    const trimmed = String(nextText || '').trim();
    if (!trimmed) {
      if (allowEmpty) onChange?.('');
      return;
    }
    if (allowEmpty && trimmed === emptyLabel) {
      onChange?.('');
      return;
    }
    const exact = normalized.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
    if (exact) onChange?.(exact.value);
  };

  return (
    <>
      <input
        list={listId}
        className={className}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          emitValue(next);
        }}
        onBlur={() => {
          // Snap back to selected option label for invalid free text
          const trimmed = String(text || '').trim();
          if (!trimmed) return;
          const exact = normalized.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
          if (!exact) setText(selectedLabel || '');
        }}
        disabled={disabled}
        {...inputProps}
      />
      <datalist id={listId}>
        {allowEmpty && <option value={emptyLabel} />}
        {normalized.map((o, index) => (
          <option key={`${o.value}-${index}`} value={o.label} />
        ))}
      </datalist>
    </>
  );
}
