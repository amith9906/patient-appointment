import React, { useState, useEffect, useCallback, useRef } from 'react';
import { treatmentPlanAPI, patientAPI, doctorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import styles from './Page.module.css';
import useDebouncedFilters from '../hooks/useDebouncedFilters';

const fmt = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  active:    { background: '#dcfce7', color: '#15803d' },
  completed: { background: '#dbeafe', color: '#1d4ed8' },
  cancelled: { background: '#fee2e2', color: '#dc2626' },
};

const INIT_FORM = {
  patientId: '', doctorId: '', name: '', description: '',
  totalSessions: 1, totalAmount: '', startDate: today(), expectedEndDate: '', notes: '',
};

export default function TreatmentPlans() {
  const { user } = useAuth();
  const [tab, setTab] = useState('list');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ patientId: '', doctorId: '', status: '' });
  const [planPage, setPlanPage] = useState(1);
  const [planPerPage, setPlanPerPage] = useState(20);
  const [planPagination, setPlanPagination] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const { filtersRef, debouncedFilters } = useDebouncedFilters(filters, 400);
  const planPageRef = useRef(planPage);
  const planPerPageRef = useRef(planPerPage);
  useEffect(() => { planPageRef.current = planPage; }, [planPage]);
  useEffect(() => { planPerPageRef.current = planPerPage; }, [planPerPage]);

  // Form state
  const [form, setForm] = useState(INIT_FORM);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  // Patient/Doctor search
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Session update
  const [sessionSaving, setSessionSaving] = useState(null);

  const load = useCallback((f) => {
    setLoading(true);
    const params = {
      page: planPageRef.current,
      per_page: planPerPageRef.current,
    };
    const applied = f || filtersRef.current;
    if (applied?.patientId) params.patientId = applied.patientId;
    if (applied?.doctorId) params.doctorId = applied.doctorId;
    if (applied?.status) params.status = applied.status;
    treatmentPlanAPI.getAll(params)
      .then((r) => {
        setPlans(r.data || []);
        setPlanPagination(r.pagination || null);
      })
      .catch(() => toast.error('Failed to load treatment plans'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    patientAPI.getAll({ paginate: 'false' }).then((r) => setPatients(r.data?.patients || r.data || [])).catch(() => {});
    if (user.role !== 'doctor') {
      doctorAPI.getAll().then((r) => setDoctors(r.data?.doctors || r.data || [])).catch(() => {});
    }
  }, [load]);

  // Reload when page/perPage changes (pagination controls)
  useEffect(() => {
    load();
  }, [load, planPage, planPerPage]);

  // When debounced filters change: reset to page 1 and reload
  useEffect(() => {
    setPlanPage(1);
    planPageRef.current = 1;
    load(debouncedFilters);
  }, [debouncedFilters.patientId, debouncedFilters.doctorId, debouncedFilters.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    setPlanPage(1);
    load(filters);
  };
  const resetFilters = () => {
    const f = { patientId: '', doctorId: '', status: '' };
    setFilters(f);
    setPlanPage(1);
    load(f);
  };

  // Summary cards
  const totalActive = plans.filter(p => p.status === 'active').length;
  const totalCompleted = plans.filter(p => p.status === 'completed').length;
  const totalCancelled = plans.filter(p => p.status === 'cancelled').length;
  const totalRevenue = plans.reduce((s, p) => s + Number(p.paidAmount || 0), 0);

  const openNew = () => {
    setEditTarget(null);
    setForm(INIT_FORM);
    setTab('new');
  };

  const openEdit = (plan) => {
    setEditTarget(plan);
    setForm({
      patientId: plan.patientId,
      doctorId: plan.doctorId,
      name: plan.name,
      description: plan.description || '',
      totalSessions: plan.totalSessions,
      totalAmount: plan.totalAmount,
      startDate: plan.startDate || today(),
      expectedEndDate: plan.expectedEndDate || '',
      notes: plan.notes || '',
    });
    setTab('new');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.patientId) return toast.error('Select a patient');
    if (!form.doctorId) return toast.error('Select a doctor');
    if (!form.name.trim()) return toast.error('Plan name is required');
    setSaving(true);
    try {
      if (editTarget) {
        await treatmentPlanAPI.update(editTarget.id, form);
        toast.success('Treatment plan updated');
      } else {
        await treatmentPlanAPI.create(form);
        toast.success('Treatment plan created');
      }
      setTab('list');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Cancel plan "${plan.name}"?`)) return;
    try {
      await treatmentPlanAPI.delete(plan.id);
      toast.success('Plan cancelled');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    }
  };

  const toggleSession = async (plan, sessionIdx) => {
    const sessions = plan.sessions.map((s, i) => {
      if (i !== sessionIdx) return s;
      const done = !s.done;
      return { ...s, done, completedDate: done ? today() : null };
    });
    setSessionSaving(`${plan.id}-${sessionIdx}`);
    try {
      await treatmentPlanAPI.update(plan.id, { sessions });
      load();
    } catch (err) {
      toast.error('Failed to update session');
    } finally {
      setSessionSaving(null);
    }
  };

  const updatePayment = async (plan, paidAmount) => {
    try {
      await treatmentPlanAPI.update(plan.id, { paidAmount: Number(paidAmount) });
      toast.success('Payment updated');
      load();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const patientOptions = patients.map(p => ({ value: p.id, label: `${p.name} (${p.patientId || ''})` }));
  const doctorOptions = doctors.map(d => ({ value: d.id, label: `Dr. ${d.name}` }));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Treatment Plans</h1>
          <p className={styles.pageSubtitle}>Manage multi-session treatment plans and track progress</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ New Plan</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['list', 'new'].map(t => (
          <button key={t} onClick={() => { if (t === 'list') { setEditTarget(null); } setTab(t); }}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: tab === t ? '#2563eb' : '#f1f5f9', color: tab === t ? '#fff' : '#475569',
            }}>
            {t === 'list' ? 'Plans List' : editTarget ? 'Edit Plan' : '+ New Plan'}
          </button>
        ))}
      </div>

      {/* ─── LIST TAB ─── */}
      {tab === 'list' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Active Plans', value: totalActive, color: '#15803d', bg: '#dcfce7' },
              { label: 'Total Paid (Rs)', value: fmt(totalRevenue), color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Completed', value: totalCompleted, color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Cancelled', value: totalCancelled, color: '#dc2626', bg: '#fee2e2' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ color: c.color, fontSize: 22, fontWeight: 700 }}>{c.value}</div>
                <div style={{ color: c.color, fontSize: 13, marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <select className={styles.filterSelect} value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className={styles.btnPrimary} onClick={applyFilters}>Filter</button>
            <button className={styles.btnSecondary} onClick={resetFilters}>Reset</button>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
          ) : plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No treatment plans found.{' '}
              <button onClick={openNew} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Create one</button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    {['Plan #','Patient','Doctor','Plan Name','Sessions','Total','Paid','Status','Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plans.map(plan => (
                    <React.Fragment key={plan.id}>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{plan.planNumber}</td>
                        <td style={{ padding: '10px 14px' }}>{plan.patient?.name || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{plan.doctor ? `Dr. ${plan.doctor.name}` : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{plan.name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontWeight: 600 }}>{plan.completedSessions}</span>
                          <span style={{ color: '#94a3b8' }}>/{plan.totalSessions}</span>
                          {plan.totalSessions > 0 && (
                            <div style={{ width: 60, height: 4, background: '#e2e8f0', borderRadius: 4, marginTop: 3 }}>
                              <div style={{
                                width: `${Math.round((plan.completedSessions / plan.totalSessions) * 100)}%`,
                                height: '100%', background: '#2563eb', borderRadius: 4,
                              }} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{fmt(plan.totalAmount)}</td>
                        <td style={{ padding: '10px 14px' }}>{fmt(plan.paidAmount)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ ...STATUS_STYLE[plan.status], borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                            {plan.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div className={styles.actions}>
                          <button className={styles.btnEdit}
                            onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}>
                            {expandedId === plan.id ? 'Hide' : 'Sessions'}
                          </button>
                          <button className={styles.btnEdit} onClick={() => openEdit(plan)}>Edit</button>
                          {plan.status === 'active' && (
                            <button className={styles.btnDelete} onClick={() => handleDelete(plan)}>Cancel</button>
                          )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === plan.id && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0, background: '#f8fafc' }}>
                            <div style={{ padding: '16px 24px' }}>
                              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#1e293b' }}>
                                Sessions — {plan.name}
                              </div>
                              {plan.description && (
                                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{plan.description}</div>
                              )}
                              {/* Payment update */}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                                <span style={{ fontSize: 13, color: '#475569' }}>Paid amount:</span>
                                <input
                                  type="number" defaultValue={plan.paidAmount}
                                  onBlur={e => { if (Number(e.target.value) !== Number(plan.paidAmount)) updatePayment(plan, e.target.value); }}
                                  style={{ width: 120, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                                />
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>of {fmt(plan.totalAmount)}</span>
                              </div>
                              {(!plan.sessions || plan.sessions.length === 0) ? (
                                <div style={{ color: '#94a3b8', fontSize: 13 }}>No sessions defined.</div>
                              ) : (
                                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: '#e2e8f0' }}>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>No.</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Name</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Planned Date</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Completed Date</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Notes</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>Done</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {plan.sessions.map((s, i) => (
                                      <tr key={i} style={{ background: s.done ? '#f0fdf4' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{s.sessionNo || i + 1}</td>
                                        <td style={{ padding: '6px 10px' }}>{s.name}</td>
                                        <td style={{ padding: '6px 10px' }}>{s.plannedDate || '—'}</td>
                                        <td style={{ padding: '6px 10px', color: s.completedDate ? '#15803d' : '#94a3b8' }}>
                                          {s.completedDate || '—'}
                                        </td>
                                        <td style={{ padding: '6px 10px', color: '#64748b' }}>{s.notes || '—'}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                          <button
                                            disabled={sessionSaving === `${plan.id}-${i}` || plan.status !== 'active'}
                                            onClick={() => toggleSession(plan, i)}
                                            style={{
                                              padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
                                              background: s.done ? '#dcfce7' : '#f1f5f9',
                                              color: s.done ? '#15803d' : '#475569',
                                              opacity: plan.status !== 'active' ? 0.5 : 1,
                                            }}>
                                            {sessionSaving === `${plan.id}-${i}` ? '...' : s.done ? 'Done' : 'Mark Done'}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {plan.notes && (
                                <div style={{ marginTop: 12, fontSize: 13, color: '#475569' }}>
                                  <strong>Notes:</strong> {plan.notes}
                                </div>
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
              <PaginationControls
                meta={planPagination}
                onPageChange={(nextPage) => setPlanPage(nextPage)}
                onPerPageChange={(value) => {
                  setPlanPerPage(value);
                  setPlanPage(1);
                }}
              />
            </>
          )}
        </>
      )}

      {/* ─── NEW / EDIT TAB ─── */}
      {tab === 'new' && (
        <div style={{ maxWidth: 700, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
            {editTarget ? `Edit Plan — ${editTarget.planNumber}` : 'New Treatment Plan'}
          </h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Patient */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Patient <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <SearchableSelect
                options={patientOptions}
                value={form.patientId}
                onChange={v => setForm(f => ({ ...f, patientId: v }))}
                placeholder="Search patient..."
              />
            </div>

            {/* Doctor */}
            {user.role !== 'doctor' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Doctor <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <SearchableSelect
                  options={doctorOptions}
                  value={form.doctorId}
                  onChange={v => setForm(f => ({ ...f, doctorId: v }))}
                  placeholder="Select doctor..."
                />
              </div>
            )}

            {/* Plan Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Plan Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input className={styles.input} value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Physiotherapy for Lower Back Pain" />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</label>
              <textarea className={styles.input} rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the treatment plan..." />
            </div>

            {/* Total Sessions + Amount */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Total Sessions <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input className={styles.input} type="number" min={1} value={form.totalSessions}
                  onChange={e => setForm(f => ({ ...f, totalSessions: Number(e.target.value) }))}
                  placeholder="1" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Total Amount (Rs)
                </label>
                <input className={styles.input} type="number" min={0} step="0.01" value={form.totalAmount}
                  onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="0.00" />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Start Date</label>
                <input className={styles.input} type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Expected End Date</label>
                <input className={styles.input} type="date" value={form.expectedEndDate}
                  onChange={e => setForm(f => ({ ...f, expectedEndDate: e.target.value }))} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</label>
              <textarea className={styles.input} rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..." />
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Saving...' : editTarget ? 'Update Plan' : 'Create Plan'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => { setTab('list'); setEditTarget(null); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
