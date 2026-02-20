import React from 'react';
import styles from './Table.module.css';

export default function Table({ columns, data, loading, emptyMessage = 'No records found' }) {
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
          <tr>{columns.map((col) => <th key={col.key} style={{ width: col.width }}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className={styles.empty}>{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
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
