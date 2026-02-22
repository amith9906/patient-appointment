/**
 * Converts an array of objects to a CSV file and triggers a browser download.
 * @param {Array<Object>} rows - Data rows
 * @param {Array<{label: string, key: string|function}>} columns - Column definitions
 * @param {string} filename - Download filename (without .csv)
 */
export function exportToCSV(rows, columns, filename = 'export') {
  const escape = (val) => {
    const str = val == null ? '' : String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
      return escape(val);
    }).join(',')
  );
  const csv = [header, ...body].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
