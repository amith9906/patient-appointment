import React, { useState, useEffect, useCallback, useRef } from 'react';
import { otAPI, patientAPI, doctorAPI, ipdAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import styles from './Page.module.css';
import useDebouncedFilters from '../hooks/useDebouncedFilters';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  scheduled:   { background: '#dbeafe', color: '#1d4ed8' },
  in_progress: { background: '#fef9c3', color: '#854d0e' },
  completed:   { background: '#dcfce7', color: '#15803d' },
  cancelled:   { background: '#fee2e2', color: '#dc2626' },
  postponed:   { background: '#ffedd5', color: '#c2410c' },
};

const INIT_BOOK_FORM = {
  patientId: '', surgeonId: '', procedureName: '', surgeryType: '', scheduledDate: today(),
  scheduledTime: '09:00', estimatedDuration: 60, otRoom: '',
  anesthesiaType: 'none', admissionId: '', preOpNotes: '',
};

const INIT_EDIT_FORM = {
  status: 'scheduled', surgeryType: '', scheduledDate: '', scheduledTime: '',
  estimatedDuration: 60, otRoom: '', anesthesiaType: 'none',
  preOpNotes: '', postOpNotes: '', outcome: '',
  actualStartTime: '', actualEndTime: '',
};

export default function OT() {
  const { user } = useAuth();
  const [tab, setTab] = useState('schedule');

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ scheduledToday: 0, inProgress: 0, completedThisMonth: 0, cancelledThisMonth: 0 });
  const [filters, setFilters] = useState({ status: '', date: '', surgeonId: '' });
  const { filtersRef, debouncedFilters } = useDebouncedFilters(filters, 400);
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePerPage, setSchedulePerPage] = useState(25);
  const [schedulePagination, setSchedulePagination] = useState(null);
  const schedulePageRef = useRef(schedulePage);
  const schedulePerPageRef = useRef(schedulePerPage);
  useEffect(() => { schedulePageRef.current = schedulePage; }, [schedulePage]);
  useEffect(() => { schedulePerPageRef.current = schedulePerPage; }, [schedulePerPage]);
  const [expandedId, setExpandedId] = useState(null);

  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [admissions, setAdmissions] = useState([]);

  const [bookForm, setBookForm] = useState(INIT_BOOK_FORM);
  const [booking, setBooking] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(INIT_EDIT_FORM);
  const [updating, setUpdating] = useState(false);
  const [quickActing, setQuickActing] = useState(null);
  const [completeModal, setCompleteModal] = useState({ open: false, schedule: null, actualEndTime: '', postOpNotes: '', outcome: '', otCharges: '' });

  const loadStats = () => {
    otAPI.getStats().then(r => setStats(r.data || {})).catch(() => {});
  };

  const loadSchedules = useCallback((f) => {
    setLoading(true);
    const params = {
      page: schedulePageRef.current,
      per_page: schedulePerPageRef.current,
    };
    const applied = f || filtersRef.current;
    if (applied?.status) params.status = applied.status;
    if (applied?.date) params.date = applied.date;
    if (applied?.surgeonId) params.surgeonId = applied.surgeonId;
    otAPI.getAll(params)
      .then((r) => {
        setSchedules(r.data || []);
        setSchedulePagination(r.pagination || null);
      })
      .catch(() => toast.error('Failed to load OT schedules'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSchedules();
    loadStats();
    patientAPI.getAll({ paginate: 'false' }).then((r) => setPatients(r.data?.patients || r.data || [])).catch(() => {});
    if (user.role !== 'doctor') {
      doctorAPI.getAll().then((r) => setDoctors(r.data?.doctors || r.data || [])).catch(() => {});
    }
    ipdAPI.getAdmissions({ status: 'admitted' }).then((r) => setAdmissions(r.data || [])).catch(() => {});
  }, [loadSchedules]);

  // Reload when page/perPage changes (pagination controls)
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules, schedulePage, schedulePerPage]);

  // When debounced filters change: reset to page 1 and reload
  useEffect(() => {
    setSchedulePage(1);
    schedulePageRef.current = 1;
    loadSchedules(debouncedFilters);
  }, [debouncedFilters.status, debouncedFilters.date, debouncedFilters.surgeonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBook = async (e) => {
    e.preventDefault();
    if (!bookForm.patientId) return toast.error('Select patient');
    if (!bookForm.surgeonId) return toast.error('Select surgeon');
    if (!bookForm.procedureName.trim()) return toast.error('Enter procedure name');
    setBooking(true);
    try {
      await otAPI.create(bookForm);
      toast.success('Surgery scheduled');
      setBookForm(INIT_BOOK_FORM);
      setTab('schedule');
      loadSchedules();
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to schedule');
    } finally {
      setBooking(false);
    }
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setEditForm({
      status: s.status,
      surgeryType: s.surgeryType || '',
      scheduledDate: s.scheduledDate,
      scheduledTime: s.scheduledTime,
      estimatedDuration: s.estimatedDuration,
      otRoom: s.otRoom || '',
      anesthesiaType: s.anesthesiaType,
      preOpNotes: s.preOpNotes || '',
      postOpNotes: s.postOpNotes || '',
      outcome: s.outcome || '',
      actualStartTime: s.actualStartTime ? s.actualStartTime.slice(0, 16) : '',
      actualEndTime: s.actualEndTime ? s.actualEndTime.slice(0, 16) : '',
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await otAPI.update(editTarget.id, editForm);
      toast.success('Updated');
      setEditModalOpen(false);
      loadSchedules();
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async (s) => {
    if (!window.confirm(`Cancel OT schedule ${s.otNumber}?`)) return;
    try {
      await otAPI.cancel(s.id);
      toast.success('Cancelled');
      loadSchedules();
      loadStats();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const handleQuickStart = async (id) => {
    setQuickActing(id);
    try {
      await otAPI.update(id, { status: 'in_progress', actualStartTime: new Date().toISOString() });
      toast.success('Surgery started');
      loadSchedules();
      loadStats();
    } catch (err) {
      toast.error('Failed to start surgery');
    } finally {
      setQuickActing(null);
    }
  };

  const handleCompleteOT = async () => {
    const { schedule, actualEndTime, postOpNotes, outcome, otCharges } = completeModal;
    setUpdating(true);
    try {
      await otAPI.update(schedule.id, {
        status: 'completed',
        actualEndTime: actualEndTime || new Date().toISOString(),
        postOpNotes,
        outcome,
      });
      if (schedule.admissionId && parseFloat(otCharges) > 0) {
        await ipdAPI.addBillItem(schedule.admissionId, {
          itemType: 'ot_charges',
          description: `OT — ${schedule.procedureName}`,
          quantity: 1,
          unitPrice: parseFloat(otCharges),
          gstRate: 5,
          date: today(),
          notes: 'Auto from OT completion',
        });
      }
      toast.success('Surgery completed');
      setCompleteModal({ open: false, schedule: null, actualEndTime: '', postOpNotes: '', outcome: '', otCharges: '' });
      loadSchedules();
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete surgery');
    } finally {
      setUpdating(false);
    }
  };

  const patientOptions = patients.map(p => ({ value: p.id, label: `${p.name} (${p.patientId || ''})` }));
  const surgeonOptions = doctors.map(d => ({ value: d.id, label: `Dr. ${d.name}${d.specialization ? ` — ${d.specialization}` : ''}` }));

  // Filter admissions to those matching selected patient
  const patientAdmissions = admissions.filter(a => a.patientId === bookForm.patientId);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>OT Management</h1>
          <p className={styles.pageSubtitle}>Operation Theatre scheduling and surgical records</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setTab('book')}>+ Schedule Surgery</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Scheduled Today', value: stats.scheduledToday, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'In Progress', value: stats.inProgress, color: '#854d0e', bg: '#fef9c3' },
          { label: 'Completed This Month', value: stats.completedThisMonth, color: '#15803d', bg: '#dcfce7' },
          { label: 'Cancelled This Month', value: stats.cancelledThisMonth, color: '#dc2626', bg: '#fee2e2' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ color: c.color, fontSize: 26, fontWeight: 700 }}>{c.value}</div>
            <div style={{ color: c.color, fontSize: 13, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {[{ key: 'schedule', label: 'OT Schedule' }, { key: 'book', label: '+ Schedule Surgery' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: 'none', borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              color: tab === t.key ? '#2563eb' : '#64748b', marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── SCHEDULE TAB ─── */}
      {tab === 'schedule' && (
        <>
          <div className={styles.filterBar}>
            <select className={styles.filterSelect} value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="postponed">Postponed</option>
            </select>
            <input type="date" className={styles.filterSelect} value={filters.date}
              onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} />
            {user.role !== 'doctor' && (
              <select className={styles.filterSelect} value={filters.surgeonId}
                onChange={e => setFilters(f => ({ ...f, surgeonId: e.target.value }))}>
                <option value="">All Surgeons</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
              </select>
            )}
            <button className={styles.btnPrimary} onClick={() => loadSchedules(filters)}>Filter</button>
            <button className={styles.btnSecondary} onClick={() => { const f = { status: '', date: '', surgeonId: '' }; setFilters(f); loadSchedules(f); }}>Reset</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
          ) : schedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No OT schedules found.{' '}
              <button onClick={() => setTab('book')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Schedule one</button>
            </div>
          ) : (
            <>
              <div className={styles.card} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      {['OT #', 'Patient', 'Surgeon', 'Procedure', 'Type', 'Date', 'Time', 'Duration', 'OT Room', 'Anesthesia', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(s => (
                      <React.Fragment key={s.id}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{s.otNumber}</td>
                          <td style={{ padding: '10px 14px' }}>{s.patient?.name || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>Dr. {s.surgeon?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>{s.procedureName}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#64748b' }}>{s.surgeryType || '—'}</td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{s.scheduledDate}</td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{s.scheduledTime}</td>
                          <td style={{ padding: '10px 14px' }}>{s.estimatedDuration} min</td>
                          <td style={{ padding: '10px 14px' }}>{s.otRoom || '—'}</td>
                          <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{s.anesthesiaType}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ ...STATUS_STYLE[s.status], borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {s.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div className={styles.actions}>
                              <button className={styles.btnEdit}
                                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                                {expandedId === s.id ? 'Hide' : 'Details'}
                              </button>
                              <button className={styles.btnEdit} onClick={() => openEdit(s)}>Edit</button>
                              {s.status === 'scheduled' && (
                                <button
                                  onClick={() => handleQuickStart(s.id)}
                                  disabled={quickActing === s.id}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#dcfce7', color: '#15803d' }}>
                                  {quickActing === s.id ? '...' : '▶ Start'}
                                </button>
                              )}
                              {s.status === 'in_progress' && (
                                <button
                                  onClick={() => {
                                    const now = new Date();
                                    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                    setCompleteModal({ open: true, schedule: s, actualEndTime: localISO, postOpNotes: '', outcome: '', otCharges: '' });
                                  }}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}>
                                  ✓ Complete
                                </button>
                              )}
                              {s.status !== 'cancelled' && s.status !== 'completed' && (
                                <button className={styles.btnDelete} onClick={() => handleCancel(s)}>Cancel</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === s.id && (
                          <tr>
                            <td colSpan={11} style={{ padding: 0, background: '#f8fafc' }}>
                              <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Pre-Op Notes</div>
                                  <div style={{ fontSize: 13, color: '#374151' }}>{s.preOpNotes || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Post-Op Notes</div>
                                  <div style={{ fontSize: 13, color: '#374151' }}>{s.postOpNotes || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Outcome</div>
                                  <div style={{ fontSize: 13, color: '#374151' }}>{s.outcome || '—'}</div>
                                </div>
                                {(s.actualStartTime || s.actualEndTime) && (
                                  <>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Actual Start</div>
                                      <div style={{ fontSize: 13 }}>{s.actualStartTime ? new Date(s.actualStartTime).toLocaleString('en-IN') : '—'}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Actual End</div>
                                      <div style={{ fontSize: 13 }}>{s.actualEndTime ? new Date(s.actualEndTime).toLocaleString('en-IN') : '—'}</div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
              <PaginationControls
                meta={schedulePagination}
                onPageChange={(nextPage) => setSchedulePage(nextPage)}
                onPerPageChange={(value) => {
                  setSchedulePerPage(value);
                  setSchedulePage(1);
                }}
              />
            </>
          )}
        </>
      )}

      {/* ─── BOOK SURGERY TAB ─── */}
      {tab === 'book' && (
        <div style={{ maxWidth: 700, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Schedule Surgery</h2>
          <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className={styles.label}>Patient <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect options={patientOptions} value={bookForm.patientId}
                onChange={v => setBookForm(f => ({ ...f, patientId: v, admissionId: '' }))}
                placeholder="Search patient..." />
            </div>
            <div>
              <label className={styles.label}>Surgeon <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect options={surgeonOptions} value={bookForm.surgeonId}
                onChange={v => setBookForm(f => ({ ...f, surgeonId: v }))}
                placeholder="Select surgeon..." />
            </div>
            <div>
              <label className={styles.label}>Procedure Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input className={styles.input} value={bookForm.procedureName} required
                onChange={e => setBookForm(f => ({ ...f, procedureName: e.target.value }))}
                placeholder="e.g., Appendectomy, Cholecystectomy..." />
            </div>
            <div>
              <label className={styles.label}>Surgery Type</label>
              <input className={styles.input} value={bookForm.surgeryType}
                onChange={e => setBookForm(f => ({ ...f, surgeryType: e.target.value }))}
                placeholder="e.g., Elective, Emergency, Minor, Major..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className={styles.label}>Date <span style={{ color: '#dc2626' }}>*</span></label>
                <input className={styles.input} type="date" value={bookForm.scheduledDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setBookForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Time <span style={{ color: '#dc2626' }}>*</span></label>
                <input className={styles.input} type="time" value={bookForm.scheduledTime}
                  onChange={e => setBookForm(f => ({ ...f, scheduledTime: e.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Estimated Duration (minutes)</label>
                <input className={styles.input} type="number" min={15} step={15} value={bookForm.estimatedDuration}
                  onChange={e => setBookForm(f => ({ ...f, estimatedDuration: Number(e.target.value) }))} />
              </div>
              <div>
                <label className={styles.label}>OT Room / Theatre</label>
                <input className={styles.input} value={bookForm.otRoom}
                  onChange={e => setBookForm(f => ({ ...f, otRoom: e.target.value }))}
                  placeholder="e.g., OT-1, Main Theatre" />
              </div>
            </div>
            <div>
              <label className={styles.label}>Anesthesia Type</label>
              <select className={styles.input} value={bookForm.anesthesiaType}
                onChange={e => setBookForm(f => ({ ...f, anesthesiaType: e.target.value }))}>
                <option value="none">None</option>
                <option value="general">General</option>
                <option value="local">Local</option>
                <option value="spinal">Spinal</option>
                <option value="epidural">Epidural</option>
              </select>
            </div>
            {bookForm.patientId && patientAdmissions.length > 0 && (
              <div>
                <label className={styles.label}>Link to IPD Admission (optional)</label>
                <select className={styles.input} value={bookForm.admissionId}
                  onChange={e => setBookForm(f => ({ ...f, admissionId: e.target.value }))}>
                  <option value="">— Not linked —</option>
                  {patientAdmissions.map(a => (
                    <option key={a.id} value={a.id}>{a.admissionNumber} — {a.admissionDiagnosis || 'No diagnosis'}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={styles.label}>Pre-Op Notes</label>
              <textarea className={styles.input} rows={2} value={bookForm.preOpNotes}
                onChange={e => setBookForm(f => ({ ...f, preOpNotes: e.target.value }))}
                placeholder="Pre-operative instructions, preparation notes..." />
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setTab('schedule')}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={booking}>
                {booking ? 'Scheduling...' : 'Schedule Surgery'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── COMPLETE MODAL ─── */}
      {completeModal.open && completeModal.schedule && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', margin: 'auto' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Complete Surgery — {completeModal.schedule.otNumber}</h3>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              {completeModal.schedule.patient?.name} | Dr. {completeModal.schedule.surgeon?.name} | {completeModal.schedule.procedureName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className={styles.label}>Actual End Time</label>
                <input className={styles.input} type="datetime-local" value={completeModal.actualEndTime}
                  onChange={e => setCompleteModal(m => ({ ...m, actualEndTime: e.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Post-Op Notes</label>
                <textarea className={styles.input} rows={2} value={completeModal.postOpNotes}
                  onChange={e => setCompleteModal(m => ({ ...m, postOpNotes: e.target.value }))}
                  placeholder="Post-operative care instructions, observations..." />
              </div>
              <div>
                <label className={styles.label}>Outcome</label>
                <textarea className={styles.input} rows={2} value={completeModal.outcome}
                  onChange={e => setCompleteModal(m => ({ ...m, outcome: e.target.value }))}
                  placeholder="Surgery outcome, complications, remarks..." />
              </div>
              {completeModal.schedule.admissionId && (
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, border: '1px solid #bbf7d0' }}>
                  <label className={styles.label} style={{ color: '#15803d' }}>OT Charges to add to IPD Bill (₹)</label>
                  <input className={styles.input} type="number" min={0} step={0.01} value={completeModal.otCharges}
                    onChange={e => setCompleteModal(m => ({ ...m, otCharges: e.target.value }))}
                    placeholder="0.00 — leave empty to skip" />
                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
                    If amount &gt; 0, an OT Charges item will be auto-added to the linked IPD bill (GST 5%).
                  </div>
                </div>
              )}
            </div>
            <div className={styles.formActions} style={{ marginTop: 20 }}>
              <button type="button" className={styles.btnSecondary}
                onClick={() => setCompleteModal({ open: false, schedule: null, actualEndTime: '', postOpNotes: '', outcome: '', otCharges: '' })}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCompleteOT} disabled={updating}>
                {updating ? 'Completing...' : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {editModalOpen && editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', margin: 'auto' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Edit OT Schedule — {editTarget.otNumber}</h3>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              {editTarget.patient?.name} | Dr. {editTarget.surgeon?.name} | {editTarget.procedureName}
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className={styles.label}>Status</label>
                  <select className={styles.input} value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label}>OT Room</label>
                  <input className={styles.input} value={editForm.otRoom}
                    onChange={e => setEditForm(f => ({ ...f, otRoom: e.target.value }))} />
                </div>
                <div>
                  <label className={styles.label}>Surgery Type</label>
                  <input className={styles.input} value={editForm.surgeryType}
                    onChange={e => setEditForm(f => ({ ...f, surgeryType: e.target.value }))} />
                </div>
                <div>
                  <label className={styles.label}>Date</label>
                  <input className={styles.input} type="date" value={editForm.scheduledDate}
                    onChange={e => setEditForm(f => ({ ...f, scheduledDate: e.target.value }))} />
                </div>
                <div>
                  <label className={styles.label}>Time</label>
                  <input className={styles.input} type="time" value={editForm.scheduledTime}
                    onChange={e => setEditForm(f => ({ ...f, scheduledTime: e.target.value }))} />
                </div>
                <div>
                  <label className={styles.label}>Duration (min)</label>
                  <input className={styles.input} type="number" min={15} value={editForm.estimatedDuration}
                    onChange={e => setEditForm(f => ({ ...f, estimatedDuration: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={styles.label}>Anesthesia</label>
                  <select className={styles.input} value={editForm.anesthesiaType}
                    onChange={e => setEditForm(f => ({ ...f, anesthesiaType: e.target.value }))}>
                    <option value="none">None</option>
                    <option value="general">General</option>
                    <option value="local">Local</option>
                    <option value="spinal">Spinal</option>
                    <option value="epidural">Epidural</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label}>Actual Start Time</label>
                  <input className={styles.input} type="datetime-local" value={editForm.actualStartTime}
                    onChange={e => setEditForm(f => ({ ...f, actualStartTime: e.target.value }))} />
                </div>
                <div>
                  <label className={styles.label}>Actual End Time</label>
                  <input className={styles.input} type="datetime-local" value={editForm.actualEndTime}
                    onChange={e => setEditForm(f => ({ ...f, actualEndTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={styles.label}>Pre-Op Notes</label>
                <textarea className={styles.input} rows={2} value={editForm.preOpNotes}
                  onChange={e => setEditForm(f => ({ ...f, preOpNotes: e.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Post-Op Notes</label>
                <textarea className={styles.input} rows={2} value={editForm.postOpNotes}
                  onChange={e => setEditForm(f => ({ ...f, postOpNotes: e.target.value }))}
                  placeholder="Post-operative care instructions, observations..." />
              </div>
              <div>
                <label className={styles.label}>Outcome</label>
                <textarea className={styles.input} rows={2} value={editForm.outcome}
                  onChange={e => setEditForm(f => ({ ...f, outcome: e.target.value }))}
                  placeholder="Surgery outcome, complications, notes..." />
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={updating}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
