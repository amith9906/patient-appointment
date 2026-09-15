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

  const findMatch = (rawText) => {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return null;
    if (allowEmpty && trimmed.toLowerCase() === emptyLabel.toLowerCase()) return null;

    // 1. Exact match by value (UUID or ID)
    let match = normalized.find((o) => o.value.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;

    // 2. Exact match by label
    match = normalized.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;

    // 3. Prefix match by label
    match = normalized.find((o) => o.label.toLowerCase().startsWith(trimmed.toLowerCase()));
    if (match) return match;

    // 4. Substring match by label
    match = normalized.find((o) => o.label.toLowerCase().includes(trimmed.toLowerCase()));
    if (match) return match;

    return null;
  };

  const emitValue = (nextText) => {
    const trimmed = String(nextText || '').trim();
    if (!trimmed || (allowEmpty && trimmed.toLowerCase() === emptyLabel.toLowerCase())) {
      if (allowEmpty) onChange?.('');
      return;
    }
    const match = findMatch(nextText);
    if (match) {
      onChange?.(match.value);
    } else if (allowEmpty) {
      onChange?.('');
    }
  };

  const handleBlur = () => {
    const trimmed = String(text || '').trim();
    if (!trimmed || (allowEmpty && trimmed.toLowerCase() === emptyLabel.toLowerCase())) {
      if (allowEmpty) {
        setText(emptyLabel === 'Select' ? '' : emptyLabel);
        onChange?.('');
      } else {
        setText(selectedLabel || '');
      }
      return;
    }

    const match = findMatch(text);
    if (match) {
      setText(match.label);
      onChange?.(match.value);
    } else {
      if (allowEmpty) {
        setText('');
        onChange?.('');
      } else {
        setText(selectedLabel || '');
      }
    }
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
        onBlur={handleBlur}
        disabled={disabled}
        {...inputProps}
      />
      <datalist id={listId}>
        {allowEmpty && <option value={emptyLabel} />}
        {normalized.map((o, index) => (
          <option key={`${o.value}-${index}`} value={o.label} data-value={o.value} />
        ))}
      </datalist>
    </>
  );
}
