import React from 'react';
import styles from './Table.module.css';

export default function Table({ columns, data, loading, emptyMessage = 'No records found' }) {
  const normalizedColumns = columns.map((col, idx) => ({
    ...col,
    __key: col.key ?? col.accessor ?? null,
    __label: col.label ?? col.header ?? col.key ?? col.accessor ?? `col_${idx}`,
    __id: col.key ?? col.accessor ?? col.label ?? col.header ?? `col_${idx}`,
  }));

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>Loading...</p>
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>{normalizedColumns.map((col) => <th key={col.__id} style={{ width: col.width }}>{col.__label}</th>)}</tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={normalizedColumns.length} className={styles.empty}>{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i}>
                {normalizedColumns.map((col) => (
                  <td key={col.__id}>
                    {col.render
                      ? (col.__key ? col.render(row[col.__key], row) : col.render(row))
                      : (col.__key ? row[col.__key] : '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
