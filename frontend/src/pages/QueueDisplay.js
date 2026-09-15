import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { appointmentAPI, doctorAPI } from '../services/api';
import { useQueueQuery, useUpdateQueueStatusMutation } from '../hooks/queries/useQueueQuery';
import PaginationControls from '../components/PaginationControls';
import TriageVitalsModal from '../components/TriageVitalsModal';
import { toast } from 'react-toastify';
import styles from './Page.module.css';
import useDebouncedFilters from '../hooks/useDebouncedFilters';

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

// Web Audio API Chime helper
function playAudioChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

// Web Speech API Voice Announcement
function announceToken(token, patientName, doctorName) {
  playAudioChime();
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); // cancel any ongoing speech

  setTimeout(() => {
    const text = `Token number ${token}. Patient ${patientName}, please proceed to consultation with Doctor ${doctorName || 'on duty'}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, 400);
}

export default function QueueDisplay() {
  const [doctors, setDoctors]           = useState([]);
  const [doctorId, setDoctorId]         = useState('');
  const [date, setDate]                 = useState(today());
  const [queue, setQueue]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [autoRefresh, setAutoRefresh]   = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [kioskMode, setKioskMode]       = useState(false);
  const [vitalsAppt, setVitalsAppt]     = useState(null);

  const lastAnnouncedRef = useRef(null);
  const intervalRef = useRef(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState(null);
  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { perPageRef.current = perPage; }, [perPage]);

  const filterValues = useMemo(() => ({ doctorId, date }), [doctorId, date]);
  const { filtersRef, debouncedFilters } = useDebouncedFilters(filterValues, 400);

  // Load doctors once
  useEffect(() => {
    doctorAPI.getAll().then(r => setDoctors(r.data || [])).catch(() => {});
  }, []);

  const fetchQueue = useCallback(async (silent = false, overrides = {}) => {
    if (!silent) setLoading(true);
    try {
      const applied = overrides.filters ?? filtersRef.current;
      const params = { date: applied.date, page: pageRef.current, per_page: perPageRef.current };
      if (applied.doctorId) params.doctorId = applied.doctorId;
      const r = await appointmentAPI.getQueue(params);
      setQueue(r.data);
      setPagination(r.pagination || null);

      // Auto voice announcement if new serving token detected
      const currentItems = r.data?.items || [];
      const currentServing = currentItems.find(i => i.status === 'in_progress');
      if (currentServing && audioEnabled && lastAnnouncedRef.current !== currentServing.id) {
        lastAnnouncedRef.current = currentServing.id;
        announceToken(currentServing.queueToken, currentServing.patient?.name || '', currentServing.doctor?.name || '');
      }
    } catch {
      if (!silent) toast.error('Failed to load queue');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [audioEnabled]);

  // TanStack Query queue hook with automatic 10s background polling
  const queryParams = useMemo(() => {
    const p = { date: debouncedFilters.date, page, per_page: perPage };
    if (debouncedFilters.doctorId) p.doctorId = debouncedFilters.doctorId;
    return p;
  }, [debouncedFilters.date, debouncedFilters.doctorId, page, perPage]);

  const { data: queueResponseData, refetch: refetchQueue } = useQueueQuery(queryParams);
  const queueMutation = useUpdateQueueStatusMutation();

  // Sync TanStack Query state to local queue state & trigger audio announcements
  useEffect(() => {
    if (queueResponseData) {
      setQueue(queueResponseData);
      setPagination(queueResponseData.pagination || null);

      const currentItems = queueResponseData?.items || queueResponseData?.data || (Array.isArray(queueResponseData) ? queueResponseData : []);
      const currentServing = currentItems.find(i => i.status === 'in_progress');
      if (currentServing && audioEnabled && lastAnnouncedRef.current !== currentServing.id) {
        lastAnnouncedRef.current = currentServing.id;
        announceToken(currentServing.queueToken, currentServing.patient?.name || '', currentServing.doctor?.name || '');
      }
    }
  }, [queueResponseData, audioEnabled]);

  const doAction = async (id, action, payload = {}) => {
    setActionLoading(v => ({ ...v, [id + action]: true }));
    try {
      await queueMutation.mutateAsync({ id, action, payload });
      toast.success(action === 'check-in' ? 'Patient checked in' : 'Status updated');

      // If starting consultation, trigger voice announcement!
      if (action === 'start' || payload.status === 'in_progress') {
        const currentItems = queue?.items || queue?.data || (Array.isArray(queue) ? queue : []);
        const item = currentItems.find(i => i.id === id);
        if (item && audioEnabled) {
          announceToken(item.queueToken, item.patient?.name || '', item.doctor?.name || '');
        }
      }
      refetchQueue();
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
    <div className={kioskMode ? 'fixed inset-0 z-50 bg-slate-900 text-white p-6 overflow-y-auto' : ''}>
      <div className={styles.pageHeader}>
        <div>
          <div className={`${styles.pageTitle} ${kioskMode ? 'text-white text-2xl font-extrabold' : ''}`}>
            🏥 OPD Live Token Queue & Waiting Area Display
          </div>
          <div className={styles.pageSubtitle}>
            Live queue tracker &nbsp;|&nbsp; Auto-refresh:{' '}
            <button
              onClick={() => setAutoRefresh(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: autoRefresh ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 12 }}
            >
              {autoRefresh ? 'ON (15s)' : 'OFF'}
            </button>
            &nbsp;|&nbsp; Voice Callout:{' '}
            <button
              onClick={() => setAudioEnabled(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: audioEnabled ? '#3b82f6' : '#94a3b8', fontWeight: 700, fontSize: 12 }}
            >
              {audioEnabled ? '🔊 ON' : '🔇 OFF'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold rounded transition"
            onClick={() => setKioskMode(v => !v)}
          >
            {kioskMode ? 'Exit Kiosk TV View' : '📺 TV Kiosk View'}
          </button>
          <button className={styles.btnPrimary} onClick={() => fetchQueue()}>
            Refresh Now
          </button>
        </div>
      </div>

      {/* Filters */}
      {!kioskMode && (
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
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Patients', value: totalActive, color: kioskMode ? '#fff' : '#1e293b', bg: kioskMode ? '#1e293b' : '#f8fafc' },
          { label: 'Waiting in Lounge', value: waiting.length, color: '#d97706', bg: kioskMode ? '#312e81' : '#fef3c7' },
          { label: 'Currently Serving', value: serving ? `Token #${serving.queueToken}` : '—', color: '#16a34a', bg: kioskMode ? '#064e3b' : '#dcfce7' },
          { label: 'Consulted', value: completed.length, color: kioskMode ? '#cbd5e1' : '#64748b', bg: kioskMode ? '#1e293b' : '#f1f5f9' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: '14px 18px', border: kioskMode ? '1px solid #334155' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: kioskMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Current serving banner */}
      {serving && (
        <div style={{
          background: 'linear-gradient(135deg, #15803d, #047857)', color: '#fff',
          borderRadius: 14, padding: '20px 28px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 24, boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.3)',
        }}>
          <div style={{ fontSize: 44, fontWeight: 900, minWidth: 80, textAlign: 'center',
            background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '8px 18px' }}>
            #{serving.queueToken}
          </div>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.1em', fontWeight: 800, color: '#a7f3d0' }}>NOW SERVING / IN CONSULTATION</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{serving.patient?.name}</div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              UHID: {serving.patient?.patientId} &nbsp;|&nbsp; Scheduled: {serving.appointmentTime?.slice(0, 5)} &nbsp;|&nbsp; Doctor: Dr. {serving.doctor?.name}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', fontWeight: 700 }}
              onClick={() => announceToken(serving.queueToken, serving.patient?.name || '', serving.doctor?.name || '')}
            >
              🔊 Call Out Token
            </button>
            <button
              className={styles.btnSecondary}
              style={{ background: '#fff', color: '#047857', fontWeight: 800 }}
              disabled={actionLoading[serving.id + 'complete']}
              onClick={() => doAction(serving.id, 'complete', { status: 'completed' })}
            >
              ✓ Mark Complete
            </button>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className={styles.card} style={{ background: kioskMode ? '#1e293b' : '#fff', borderColor: kioskMode ? '#334155' : '#e2e8f0' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading live token queue...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No active appointments in queue for {date}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: kioskMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Token #', 'Patient Name & UHID', 'Slot Time', 'Doctor', 'Type', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: kioskMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>
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
                        borderBottom: kioskMode ? '1px solid #334155' : '1px solid #f1f5f9',
                        background: isServing ? (kioskMode ? '#064e3b' : '#f0fdf4') : idx % 2 === 0 ? (kioskMode ? '#1e293b' : '#fff') : (kioskMode ? '#0f172a' : '#fafafa'),
                      }}
                    >
                      {/* Token */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 38, height: 38, borderRadius: '50%',
                          background: isServing ? '#16a34a' : (kioskMode ? '#334155' : '#e2e8f0'),
                          color: isServing ? '#fff' : (kioskMode ? '#f8fafc' : '#374151'),
                          fontWeight: 900, fontSize: 15,
                        }}>
                          {item.queueToken}
                        </span>
                      </td>
                      {/* Patient */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: kioskMode ? '#f8fafc' : '#1e293b', fontSize: 14 }}>{item.patient?.name}</div>
                        <div style={{ fontSize: 11, color: kioskMode ? '#94a3b8' : '#64748b' }}>UHID: {item.patient?.patientId}</div>
                      </td>
                      {/* Time */}
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: kioskMode ? '#cbd5e1' : '#334155' }}>
                        {item.appointmentTime?.slice(0, 5)}
                      </td>
                      {/* Doctor */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: kioskMode ? '#f1f5f9' : '#1e293b' }}>Dr. {item.doctor?.name}</div>
                        <div style={{ fontSize: 11, color: kioskMode ? '#94a3b8' : '#64748b' }}>{item.doctor?.specialization}</div>
                      </td>
                      {/* Type */}
                      <td style={{ padding: '12px 14px', color: kioskMode ? '#cbd5e1' : '#64748b' }}>
                        {TYPE_LABEL[item.type] || item.type}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '12px 14px' }}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            title="Voice Callout Token"
                            onClick={() => announceToken(item.queueToken, item.patient?.name || '', item.doctor?.name || '')}
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            🔊 Call
                          </button>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            title="Record OPD Triage Vitals"
                            onClick={() => setVitalsAppt(item)}
                            style={{ fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8' }}
                          >
                            🩺 Vitals
                          </button>
                          {['scheduled', 'postponed'].includes(item.status) && (
                            <button
                              className={styles.btnWarning}
                              disabled={actionLoading[item.id + 'check-in']}
                              onClick={() => doAction(item.id, 'check-in')}
                            >
                              Check In
                            </button>
                          )}
                          {item.status === 'confirmed' && (
                            <button
                              className={styles.btnSuccess}
                              disabled={actionLoading[item.id + 'start']}
                              onClick={() => doAction(item.id, 'start', { status: 'in_progress' })}
                            >
                              Start Consult
                            </button>
                          )}
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

      <div className="mt-4 flex items-center justify-between">
        <PaginationControls
          meta={pagination}
          onPageChange={(next) => setPage(next)}
          onPerPageChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
        {noShow.length > 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {noShow.length} no-show{noShow.length > 1 ? 's' : ''} today
          </div>
        )}
      </div>

      {vitalsAppt && (
        <TriageVitalsModal
          appointment={vitalsAppt}
          onClose={() => setVitalsAppt(null)}
          onSuccess={() => toast.success('Triage vitals recorded successfully')}
        />
      )}
    </div>
  );
}
