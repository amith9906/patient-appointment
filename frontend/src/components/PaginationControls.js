import React from 'react';

const sizes = [10, 25, 50, 100];

const rootStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 0',
  fontSize: 13,
  color: '#4b5563',
};

const controlsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const buttonStyle = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5f5',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
  color: '#1f2937',
  transition: 'all 0.15s',
};

const disabledStyle = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

export default function PaginationControls({ meta, onPageChange, onPerPageChange }) {
  if (!meta) return null;
  const { currentPage, totalPages, perPage, total, hasNext, hasPrev } = meta;
  return (
    <div style={rootStyle}>
      <div style={{ fontWeight: 500 }}>
        Showing page {currentPage} of {totalPages} ({total.toLocaleString()} records)
      </div>
      <div style={controlsStyle}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={!hasPrev}
          style={{ ...buttonStyle, ...(hasPrev ? {} : disabledStyle) }}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={!hasNext}
          style={{ ...buttonStyle, ...(hasNext ? {} : disabledStyle) }}
        >
          Next
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ marginRight: 4 }}>Per page:</label>
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5f5', background: '#fff' }}
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
