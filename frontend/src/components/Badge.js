import React from 'react';

const colors = {
  scheduled: { bg: '#dbeafe', color: '#1d4ed8' },
  postponed: { bg: '#ffedd5', color: '#c2410c' },
  confirmed: { bg: '#dcfce7', color: '#15803d' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c' },
  in_progress: { bg: '#fef9c3', color: '#854d0e' },
  no_show: { bg: '#f3f4f6', color: '#6b7280' },
  ordered: { bg: '#ede9fe', color: '#6d28d9' },
  processing: { bg: '#fef9c3', color: '#92400e' },
  active: { bg: '#dcfce7', color: '#15803d' },
  inactive: { bg: '#fee2e2', color: '#b91c1c' },
  success: { bg: '#dcfce7', color: '#15803d' },
  danger: { bg: '#fee2e2', color: '#b91c1c' },
  warning: { bg: '#fef9c3', color: '#854d0e' },
  info: { bg: '#dbeafe', color: '#1d4ed8' },
  primary: { bg: '#ede9fe', color: '#6d28d9' },
  tablet: { bg: '#dbeafe', color: '#1d4ed8' },
  capsule: { bg: '#ede9fe', color: '#6d28d9' },
  default: { bg: '#f1f5f9', color: '#475569' },
};

export default function Badge({ text, type, color, children }) {
  const tone = type ?? color ?? 'default';
  const toneKey = String(tone).toLowerCase();
  const style = colors[tone] || colors[toneKey] || colors.default;
  const content = text ?? children ?? '';

  return (
    <span style={{
      background: style.bg,
      color: style.color,
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      display: 'inline-block',
      textTransform: 'capitalize',
    }}>
      {content}
    </span>
  );
}
