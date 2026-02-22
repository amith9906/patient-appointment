import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentAPI, doctorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import styles from './Page.module.css';
import PaginationControls from '../components/PaginationControls';

const today = () => new Date().toISOString().slice(0, 10);

const getDaysLabel = (followUpDate) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(followUpDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#dc2626', bg: '#fee2e2' };
  if (diff === 0) return { label: 'Due Today', color: '#d97706', bg: '#fef9c3' };
  if (diff === 1) return { label: 'Tomorrow', color: '#2563eb', bg: '#dbeafe' };
  return { label: `In ${diff} days`, color: '#475569', bg: '#f1f5f9' };
};

const getRowBg = (followUpDate) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(followUpDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return '#fff5f5';
  if (diff === 0) return '#fefce8';
  return '#fff';
};

export default function FollowUps() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [filters, setFilters] = useState({ followUpFrom: '', followUpTo: '', doctorId: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState(null);

  const load = useCallback((overrides = {}) => {
    setLoading(true);
    const targetPage = overrides.page ?? page;
    const targetPerPage = overrides.perPage ?? perPage;
    const f = overrides.filters ?? filters;
    const params = {
      followUp: 'true',
      page: targetPage,
      per_page: targetPerPage,
    };
    if (f.followUpFrom) params.followUpFrom = f.followUpFrom;
    if (f.followUpTo) params.followUpTo = f.followUpTo;
    if (f.doctorId) params.doctorId = f.doctorId;
    appointmentAPI.getAll(params)
      .then((r) => {
        setAppointments(r.data || []);
        setPagination(r.pagination || null);
      })
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [filters, page, perPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.followUpFrom, filters.followUpTo, filters.doctorId]);

  useEffect(() => {
    if (user.role !== 'doctor') {
      doctorAPI.getAll().then((r) => setDoctors(r.data?.doctors || r.data || [])).catch(() => {});
    }
  }, [user.role]);

  const todayStr = today();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  const overdue = appointments.filter(a => a.followUpDate < todayStr);
  const dueToday = appointments.filter(a => a.followUpDate === todayStr);
  const dueThisWeek = appointments.filter(a => a.followUpDate > todayStr && a.followUpDate <= nextWeekStr);

  const getAppointmentPath = (a) => {
    if (user.role === 'doctor') return `/doctor-portal/appointments/${a.id}`;
    return `/appointments/${a.id}`;
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Follow-up Tracker</h1>
          <p className={styles.pageSubtitle}>Monitor patients due for follow-up appointments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Overdue', value: overdue.length, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Due Today', value: dueToday.length, color: '#d97706', bg: '#fef9c3' },
          { label: 'Due This Week', value: dueThisWeek.length, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Total Pending', value: pagination?.total ?? appointments.length, color: '#7c3aed', bg: '#ede9fe' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ color: c.color, fontSize: 28, fontWeight: 700 }}>{c.value}</div>
            <div style={{ color: c.color, fontSize: 13, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>FROM</label>
          <input type="date" className={styles.filterSelect} value={filters.followUpFrom}
            onChange={e => setFilters(f => ({ ...f, followUpFrom: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>TO</label>
          <input type="date" className={styles.filterSelect} value={filters.followUpTo}
            onChange={e => setFilters(f => ({ ...f, followUpTo: e.target.value }))} />
        </div>
        {user.role !== 'doctor' && (
          <select className={styles.filterSelect} value={filters.doctorId}
            onChange={e => setFilters(f => ({ ...f, doctorId: e.target.value }))}>
            <option value="">All Doctors</option>
            {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
          </select>
        )}
        <button className={styles.btnPrimary} onClick={() => { setPage(1); load({ page: 1 }); }}>Filter</button>
        <button className={styles.btnSecondary} onClick={() => {
          const f = { followUpFrom: '', followUpTo: '', doctorId: '' };
          setFilters(f);
          setPage(1);
          load({ filters: f, page: 1 });
        }}>Reset</button>
        {/* Quick filters */}
        <button className={styles.btnSecondary} onClick={() => {
          const f = { followUpFrom: '', followUpTo: todayStr, doctorId: filters.doctorId };
          setFilters(f);
          setPage(1);
          load({ filters: f, page: 1 });
        }} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
          Overdue
        </button>
        <button className={styles.btnSecondary} onClick={() => {
          const f = { followUpFrom: todayStr, followUpTo: todayStr, doctorId: filters.doctorId };
          setFilters(f);
          setPage(1);
          load({ filters: f, page: 1 });
        }} style={{ background: '#fef9c3', color: '#d97706', border: '1px solid #fde68a' }}>
          Today
        </button>
        <button className={styles.btnSecondary} onClick={() => {
          const f = { followUpFrom: todayStr, followUpTo: nextWeekStr, doctorId: filters.doctorId };
          setFilters(f);
          setPage(1);
          load({ filters: f, page: 1 });
        }} style={{ background: '#dbeafe', color: '#2563eb', border: '1px solid #93c5fd' }}>
          This Week
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
      ) : appointments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          No follow-ups found for the selected filters.
        </div>
        ) : (
        <div className={styles.card} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['Patient', 'Phone', 'Doctor', 'Original Visit', 'Follow-up Date', 'Urgency', 'Diagnosis', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => {
                  const urgency = getDaysLabel(a.followUpDate);
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', background: getRowBg(a.followUpDate) }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{a.patient?.name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 13 }}>{a.patient?.phone || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>Dr. {a.doctor?.name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{a.appointmentDate || '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.followUpDate}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: urgency.bg, color: urgency.color, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {urgency.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>
                          {a.diagnosis || a.reason || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button className={styles.btnEdit} onClick={() => navigate(getAppointmentPath(a))}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls
            meta={pagination}
            onPageChange={(next) => {
              setPage(next);
              load({ page: next });
            }}
            onPerPageChange={(value) => {
              setPerPage(value);
              setPage(1);
              load({ page: 1, perPage: value });
            }}
          />
        </div>
      )}
    </div>
  );
}
