import React, { useState, useEffect, useCallback, useRef } from 'react';
import { appointmentAPI, doctorAPI } from '../services/api';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const today = () => new Date().toISOString().split('T')[0];

const STATUS_META = {
  scheduled:   { label: 'Waiting',      color: '#d97706', bg: '#fef3c7' },
  postponed:   { label: 'Postponed',    color: '#6366f1', bg: '#ede9fe' },
  confirmed:   { label: 'Checked In',   color: '#2563eb', bg: '#dbeafe' },
  in_progress: { label: 'In Progress',  color: '#16a34a', bg: '#dcfce7' },
  completed:   { label: 'Done',         color: '#64748b', bg: '#f1f5f9' },
  no_show:     { label: 'No Show',      color: '#b91c1c', bg: '#fee2e2' },
  cancelled:   { label: 'Cancelled',    color: '#9ca3af', bg: '#f9fafb' },
};

const TYPE_LABEL = {
  consultation:    'Consultation',
  follow_up:       'Follow-up',
  emergency:       'Emergency',
  routine_checkup: 'Checkup',
  lab_test:        'Lab Test',
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#64748b', bg: '#f1f5f9' };
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>
      {m.label}
    </span>
  );
}

export default function QueueDisplay() {
  const [doctors, setDoctors]           = useState([]);
  const [doctorId, setDoctorId]         = useState('');
  const [date, setDate]                 = useState(today());
  const [queue, setQueue]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [autoRefresh, setAutoRefresh]   = useState(true);
  const intervalRef = useRef(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState(null);

  // Load doctors once
  useEffect(() => {
    doctorAPI.getAll().then(r => setDoctors(r.data || [])).catch(() => {});
  }, []);

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { date, page, per_page: perPage };
      if (doctorId) params.doctorId = doctorId;
      const r = await appointmentAPI.getQueue(params);
      setQueue(r.data);
      setPagination(r.pagination || null);
    } catch {
      if (!silent) toast.error('Failed to load queue');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, doctorId]);

  // Fetch on filter change
  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    setPage(1);
  }, [doctorId, date]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchQueue(true), 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchQueue]);

  const doAction = async (id, action, payload = {}) => {
    setActionLoading(v => ({ ...v, [id + action]: true }));
    try {
      if (action === 'check-in') {
        await appointmentAPI.checkIn(id);
        toast.success('Patient checked in');
      } else {
        await appointmentAPI.update(id, payload);
        toast.success('Status updated');
      }
      fetchQueue(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(v => ({ ...v, [id + action]: false }));
    }
  };

  const items        = queue?.items || [];
  const serving      = items.find(i => i.status === 'in_progress');
  const waiting      = items.filter(i => ['scheduled', 'postponed', 'confirmed'].includes(i.status));
  const completed    = items.filter(i => i.status === 'completed');
  const noShow       = items.filter(i => i.status === 'no_show');
  const totalActive  = queue?.total ?? items.length;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Token Queue</div>
          <div className={styles.pageSubtitle}>
            Live appointment queue &nbsp;|&nbsp; Auto-refresh:{' '}
            <button
              onClick={() => setAutoRefresh(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: autoRefresh ? '#16a34a' : '#b91c1c', fontWeight: 700, fontSize: 12 }}
            >
              {autoRefresh ? 'ON (30s)' : 'OFF'}
            </button>
          </div>
        </div>
        <button className={styles.btnPrimary} onClick={() => fetchQueue()}>
          Refresh Now
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={doctorId}
          onChange={e => setDoctorId(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">All Doctors</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
          ))}
        </select>
        <input
          type="date"
          className={styles.filterSelect}
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <button className={styles.btnSecondary} onClick={() => setDate(today())}>
          Today
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total',       value: totalActive, color: '#1e293b', bg: '#f8fafc' },
          { label: 'Waiting',     value: waiting.length,   color: '#d97706', bg: '#fef3c7' },
          { label: 'Now Serving', value: serving ? `Token ${serving.queueToken}` : '—', color: '#16a34a', bg: '#dcfce7' },
          { label: 'Completed',   value: completed.length, color: '#64748b', bg: '#f1f5f9' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Current serving banner */}
      {serving && (
        <div style={{
          background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff',
          borderRadius: 12, padding: '16px 24px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ fontSize: 36, fontWeight: 900, minWidth: 60, textAlign: 'center',
            background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 14px' }}>
            {serving.queueToken}
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>NOW SERVING</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{serving.patient?.name}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {serving.patient?.patientId} &nbsp;|&nbsp; {serving.appointmentTime?.slice(0, 5)} &nbsp;|&nbsp;
              {serving.doctor?.name}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button
              className={styles.btnSecondary}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
              disabled={actionLoading[serving.id + 'complete']}
              onClick={() => doAction(serving.id, 'complete', { status: 'completed' })}
            >
              Mark Complete
            </button>
          </div>
          <PaginationControls
            meta={pagination}
            onPageChange={(next) => setPage(next)}
            onPerPageChange={(value) => {
              setPerPage(value);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Queue table */}
      <div className={styles.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading queue...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No appointments in queue for {date}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Token', 'Patient', 'Time', 'Doctor', 'Type', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isServing = item.status === 'in_progress';
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isServing ? '#f0fdf4' : idx % 2 === 0 ? '#fff' : '#fafafa',
                      }}
                    >
                      {/* Token */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 34, height: 34, borderRadius: '50%',
                          background: isServing ? '#16a34a' : '#e2e8f0',
                          color: isServing ? '#fff' : '#374151',
                          fontWeight: 800, fontSize: 14,
                        }}>
                          {item.queueToken}
                        </span>
                      </td>
                      {/* Patient */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.patient?.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.patient?.patientId}</div>
                        {item.patient?.phone && (
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.patient.phone}</div>
                        )}
                      </td>
                      {/* Time */}
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        {item.appointmentTime?.slice(0, 5)}
                      </td>
                      {/* Doctor */}
                      <td style={{ padding: '10px 14px' }}>
                        <div>{item.doctor?.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.doctor?.specialization}</div>
                      </td>
                      {/* Type */}
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        {TYPE_LABEL[item.type] || item.type}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '10px 14px' }}>
                        <div className={styles.actions}>
                          {/* Check In: for scheduled/postponed */}
                          {['scheduled', 'postponed'].includes(item.status) && (
                            <button
                              className={styles.btnWarning}
                              disabled={actionLoading[item.id + 'check-in']}
                              onClick={() => doAction(item.id, 'check-in')}
                            >
                              Check In
                            </button>
                          )}
                          {/* Start: for confirmed */}
                          {item.status === 'confirmed' && (
                            <button
                              className={styles.btnSuccess}
                              disabled={actionLoading[item.id + 'start']}
                              onClick={() => doAction(item.id, 'start', { status: 'in_progress' })}
                            >
                              Start
                            </button>
                          )}
                          {/* Complete / No Show: for in_progress or confirmed */}
                          {['confirmed', 'in_progress'].includes(item.status) && (
                            <button
                              className={styles.btnSuccess}
                              style={{ background: '#dcfce7', color: '#15803d' }}
                              disabled={actionLoading[item.id + 'complete']}
                              onClick={() => doAction(item.id, 'complete', { status: 'completed' })}
                            >
                              Done
                            </button>
                          )}
                          {['scheduled', 'postponed', 'confirmed'].includes(item.status) && (
                            <button
                              className={styles.btnDelete}
                              disabled={actionLoading[item.id + 'noshow']}
                              onClick={() => doAction(item.id, 'noshow', { status: 'no_show' })}
                            >
                              No Show
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {noShow.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
          {noShow.length} no-show{noShow.length > 1 ? 's' : ''} today (excluded from queue above)
        </div>
      )}
    </div>
  );
}
