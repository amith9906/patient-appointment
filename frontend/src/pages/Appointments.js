import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentAPI, doctorAPI, patientAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import CalendarView from '../components/CalendarView';
import { toast } from 'react-toastify';
import styles from './Page.module.css';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const INIT = { patientId: '', doctorId: '', appointmentDate: '', appointmentTime: '', type: 'consultation', reason: '', notes: '', fee: '' };
const STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
const LS_SMART   = 'appt_smart_defaults';
const LS_PREF_DR = 'appt_preferred_doctor';
const QUICK_INIT = { name: '', phone: '', gender: 'male', dateOfBirth: '', bloodGroup: '' };

export default function Appointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [patients, setPatients]         = useState([]);
  const [slots, setSlots]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(false);
  const [detailModal, setDetailModal]   = useState(null);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(INIT);
  const [filters, setFilters]           = useState({ status: '', date: '' });

  // Smart defaults
  const [smartDefaults, setSmartDefaults] = useState(() => localStorage.getItem(LS_SMART) !== 'false');
  const toggleSmartDefaults = (v) => { setSmartDefaults(v); localStorage.setItem(LS_SMART, v ? 'true' : 'false'); };

  // Patient typeahead combobox
  const [patientQuery, setPatientQuery]   = useState('');
  const [patientDropOpen, setPatientDropOpen] = useState(false);
  const comboRef = useRef(null);

  // Quick-create new patient inline
  const [quickCreate, setQuickCreate]   = useState(false);
  const [quickForm, setQuickForm]       = useState(QUICK_INIT);
  const [quickSaving, setQuickSaving]   = useState(false);

  // Calendar
  const [viewMode, setViewMode]                   = useState('list');
  const [calendarView, setCalendarView]           = useState('week');
  const [calendarDate, setCalendarDate]           = useState(new Date());
  const [calendarAppointments, setCalendarAppointments] = useState([]);
  const [calendarLoading, setCalendarLoading]     = useState(false);
  const [calendarDoctorFilter, setCalendarDoctorFilter] = useState('');

  // Close patient dropdown on click-outside
  useEffect(() => {
    const handler = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setPatientDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.date)   params.date   = filters.date;
    Promise.all([appointmentAPI.getAll(params), doctorAPI.getAll(), patientAPI.getAll()])
      .then(([a, d, p]) => { setAppointments(a.data); setDoctors(d.data); setPatients(p.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [filters]);

  // Calendar appointments
  useEffect(() => {
    if (viewMode !== 'calendar') return;
    setCalendarLoading(true);
    const from = format(startOfWeek(calendarDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const to   = format(endOfWeek(calendarDate,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const params = { from, to };
    if (calendarDoctorFilter) params.doctorId = calendarDoctorFilter;
    appointmentAPI.getAll(params)
      .then(r => setCalendarAppointments(r.data))
      .catch(() => setCalendarAppointments([]))
      .finally(() => setCalendarLoading(false));
  }, [viewMode, calendarDate, calendarDoctorFilter]);

  const refreshCalendar = () => {
    if (viewMode !== 'calendar') return;
    const from = format(startOfWeek(calendarDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const to   = format(endOfWeek(calendarDate,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const params = { from, to };
    if (calendarDoctorFilter) params.doctorId = calendarDoctorFilter;
    appointmentAPI.getAll(params).then(r => setCalendarAppointments(r.data));
  };

  // ── Form helpers ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setSlots([]);
    setPatientQuery('');
    setPatientDropOpen(false);
    setQuickCreate(false);
    setQuickForm(QUICK_INIT);
    let defaults = { ...INIT };
    if (smartDefaults) {
      if (doctors.length === 1) {
        defaults.doctorId = doctors[0].id;
        defaults.fee = String(doctors[0].consultationFee || '');
      } else {
        const preferred = localStorage.getItem(LS_PREF_DR);
        const prefDoc = preferred && doctors.find(d => d.id === preferred);
        if (prefDoc) { defaults.doctorId = prefDoc.id; defaults.fee = String(prefDoc.consultationFee || ''); }
      }
    }
    setForm(defaults);
    setModal(true);
  };

  const set = (k, v) => {
    const updated = { ...form, [k]: v };
    if (k === 'doctorId' && v) {
      const doc = doctors.find(d => d.id === v);
      if (doc?.consultationFee) updated.fee = String(doc.consultationFee);
    }
    setForm(updated);
    if (k === 'doctorId' || k === 'appointmentDate') loadSlots(updated.doctorId, updated.appointmentDate);
  };

  const loadSlots = async (doctorId, date) => {
    if (!doctorId || !date) return;
    try { const res = await doctorAPI.getSlots(doctorId, date); setSlots(res.data); }
    catch { setSlots([]); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await appointmentAPI.update(editing.id, form); toast.success('Appointment updated'); }
      else {
        await appointmentAPI.create(form);
        toast.success('Appointment scheduled');
        if (form.doctorId) localStorage.setItem(LS_PREF_DR, form.doctorId);
      }
      setModal(false); load(); refreshCalendar();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleStatus = async (id, status) => {
    try { await appointmentAPI.update(id, { status }); toast.success(`Status updated to ${status}`); load(); }
    catch { toast.error('Error'); }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt('Reason for cancellation:');
    if (reason === null) return;
    try { await appointmentAPI.cancel(id, reason); toast.success('Appointment cancelled'); load(); }
    catch { toast.error('Error'); }
  };

  const handlePaymentStatus = async (id, isPaid) => {
    try {
      await appointmentAPI.update(id, { isPaid });
      toast.success(isPaid ? 'Marked as paid' : 'Marked as unpaid');
      load();
      refreshCalendar();
      if (detailModal?.id === id) setDetailModal((prev) => ({ ...prev, isPaid }));
    } catch {
      toast.error('Unable to update payment status');
    }
  };

  // ── Patient typeahead ────────────────────────────────────────────────────────
  const selectedPatient = patients.find(p => p.id === form.patientId);

  const typeaheadPatients = (() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients.filter(p =>
      [p.name, p.patientId, p.phone, p.email].filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    ).slice(0, 8);
  })();

  const selectPatient = (p) => {
    setForm(f => ({ ...f, patientId: p.id }));
    setPatientQuery('');
    setPatientDropOpen(false);
    setQuickCreate(false);
  };

  const clearPatient = () => {
    setForm(f => ({ ...f, patientId: '' }));
    setPatientQuery('');
    setPatientDropOpen(false);
  };

  // ── Quick-create new patient ─────────────────────────────────────────────────
  const handleQuickCreate = async () => {
    if (!quickForm.name.trim()) return toast.error('Name is required');
    if (!quickForm.phone.trim()) return toast.error('Phone is required');
    setQuickSaving(true);
    try {
      const payload = { ...quickForm };
      // For non-super-admin, backend fills hospitalId from scope.
      // For super-admin, pick from first doctor's hospital if available.
      if (!payload.hospitalId) payload.hospitalId = doctors[0]?.hospitalId || '';
      const res = await patientAPI.create(payload);
      const newPat = res.data;
      setPatients(prev => [newPat, ...prev]);
      selectPatient(newPat);
      toast.success(`Patient "${newPat.name}" created and selected`);
      setQuickForm(QUICK_INIT);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create patient');
    } finally { setQuickSaving(false); }
  };

  // ── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    { key: 'appointmentNumber', label: 'Apt #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { key: 'appointmentDate',   label: 'Date' },
    { key: 'appointmentTime',   label: 'Time', render: (v) => v?.slice(0, 5) },
    { key: 'patient', label: 'Patient', render: (v) => <div><div style={{ fontWeight: 600 }}>{v?.name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{v?.patientId}</div></div> },
    { key: 'doctor',  label: 'Doctor',  render: (v) => v ? `Dr. ${v.name}` : '—' },
    { key: 'type',    label: 'Type',    render: (v) => <Badge text={v} type="default" /> },
    { key: 'status',  label: 'Status',  render: (v) => <Badge text={v} type={v} /> },
    { key: 'isPaid',  label: 'Payment', render: (v) => <Badge text={v ? 'Paid' : 'Unpaid'} type={v ? 'active' : 'inactive'} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => navigate(`/appointments/${r.id}`)}>View / Edit</button>
        {r.status === 'scheduled'  && <button className={styles.btnSuccess} onClick={() => handleStatus(r.id, 'confirmed')}>Confirm</button>}
        {r.status === 'confirmed'  && <button className={styles.btnWarning} onClick={() => handleStatus(r.id, 'in_progress')}>Start</button>}
        {r.status === 'in_progress'&& <button className={styles.btnSuccess} onClick={() => handleStatus(r.id, 'completed')}>Complete</button>}
        {(Number(r.fee || 0) + Number(r.treatmentBill || 0)) > 0 && (
          <button
            className={r.isPaid ? styles.btnWarning : styles.btnSuccess}
            onClick={() => handlePaymentStatus(r.id, !r.isPaid)}
          >
            {r.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
          </button>
        )}
        {!['cancelled','completed','no_show'].includes(r.status) && <button className={styles.btnDelete} onClick={() => handleCancel(r.id)}>Cancel</button>}
      </div>
    )},
  ];

  return (
    <div>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Appointments</h2>
          <p className={styles.pageSubtitle}>{appointments.length} appointments</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {[['list','☰ List'],['calendar','📅 Calendar']].map(([v, label]) => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: viewMode === v ? '#2563eb' : '#fff', color: viewMode === v ? '#fff' : '#64748b', transition: 'background 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={openCreate}>+ Schedule Appointment</button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
          <div className={styles.filterBar}>
            <input type="date" className={styles.filterSelect} value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} />
            <select className={styles.filterSelect} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <button className={styles.btnSecondary} onClick={() => setFilters({ status: '', date: '' })}>Clear</button>
          </div>
          <div className={styles.card}><Table columns={columns} data={appointments} loading={loading} /></div>
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {viewMode === 'calendar' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Filter by Doctor:</label>
            <select value={calendarDoctorFilter} onChange={e => setCalendarDoctorFilter(e.target.value)}
              className={styles.filterSelect} style={{ minWidth: 200 }}>
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialization}</option>)}
            </select>
          </div>
          <CalendarView appointments={calendarAppointments} view={calendarView} currentDate={calendarDate}
            onNavigate={setCalendarDate} onViewChange={setCalendarView} onAppointmentClick={a => navigate(`/appointments/${a.id}`)}
            showDoctor={true} loading={calendarLoading} />
        </div>
      )}

      {/* ── Schedule Appointment Modal ── */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Schedule Appointment" size="lg">
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Smart defaults toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Smart Defaults</span>
            <button type="button" onClick={() => toggleSmartDefaults(!smartDefaults)}
              title={smartDefaults ? 'Auto-selects doctor & fills fee' : 'Smart defaults off'}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center',
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: smartDefaults ? '#2563eb' : '#d1d5db', transition: 'background 0.2s', padding: 0 }}>
              <span style={{ display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transform: smartDefaults ? 'translateX(18px)' : 'translateX(2px)' }} />
            </button>
            <span style={{ fontSize: 11, color: smartDefaults ? '#2563eb' : '#94a3b8', fontWeight: 500, minWidth: 20 }}>
              {smartDefaults ? 'On' : 'Off'}
            </span>
          </div>

          {/* ── Patient Combobox ── */}
          <div className={styles.field} style={{ marginBottom: 14, position: 'relative' }} ref={comboRef}>
            <label className={styles.label}>Patient *</label>

            {/* Selected patient chip */}
            {selectedPatient && !patientDropOpen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                border: '1px solid #bfdbfe', borderRadius: 8, background: '#eff6ff' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e40af' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 12, color: '#3b82f6' }}>
                    {selectedPatient.patientId}
                    {selectedPatient.phone && ` · ${selectedPatient.phone}`}
                    {selectedPatient.bloodGroup && ` · ${selectedPatient.bloodGroup}`}
                  </div>
                </div>
                <button type="button" onClick={clearPatient}
                  style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px' }}
                  title="Change patient">×</button>
              </div>
            ) : (
              <input
                className={styles.input}
                value={patientQuery}
                autoComplete="off"
                placeholder="Type name, ID or phone to search…"
                onChange={e => { setPatientQuery(e.target.value); setPatientDropOpen(true); setForm(f => ({ ...f, patientId: '' })); }}
                onFocus={() => setPatientDropOpen(true)}
              />
            )}

            {/* Dropdown */}
            {patientDropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff',
                border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>

                {typeaheadPatients.length === 0 && patientQuery ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: '#94a3b8' }}>
                    No patients found for <strong>"{patientQuery}"</strong>
                  </div>
                ) : (
                  typeaheadPatients.map(p => (
                    <button key={p.id} type="button" onClick={() => selectPatient(p)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: 'none', border: 'none', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                        {p.patientId}
                        {p.phone && ` · ${p.phone}`}
                        {p.gender && ` · ${p.gender}`}
                        {p.bloodGroup && ` · ${p.bloodGroup}`}
                      </div>
                    </button>
                  ))
                )}

                {/* ── New Patient option ── */}
                <button type="button"
                  onClick={() => { setPatientDropOpen(false); setQuickCreate(true); setQuickForm(f => ({ ...f, name: patientQuery })); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px solid #e2e8f0',
                    cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  {patientQuery ? `New patient "${patientQuery}"` : 'Create new patient'}
                </button>
              </div>
            )}
          </div>

          {/* ── Quick-create new patient form ── */}
          {quickCreate && (
            <div style={{ border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, background: '#eff6ff', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>+ New Patient</span>
                <button type="button" onClick={() => setQuickCreate(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Full Name *', field: 'name', type: 'text', placeholder: 'Patient full name' },
                  { label: 'Phone *', field: 'phone', type: 'tel', placeholder: 'Mobile number' },
                  { label: 'Date of Birth', field: 'dateOfBirth', type: 'date', placeholder: '', optional: true },
                ].map(({ label, field, type, placeholder, optional }) => (
                  <div key={field}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', display: 'block', marginBottom: 3 }}>
                      {label}{optional && <span style={{ fontWeight: 400, color: '#60a5fa', marginLeft: 4 }}>(optional)</span>}
                    </label>
                    <input type={type} className={styles.input}
                      value={quickForm[field] || ''} placeholder={placeholder}
                      onChange={e => setQuickForm(f => ({ ...f, [field]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', display: 'block', marginBottom: 3 }}>Gender</label>
                  <select className={styles.input} value={quickForm.gender}
                    onChange={e => setQuickForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', display: 'block', marginBottom: 3 }}>
                    Blood Group <span style={{ fontWeight: 400, color: '#60a5fa' }}>(optional)</span>
                  </label>
                  <select className={styles.input} value={quickForm.bloodGroup}
                    onChange={e => setQuickForm(f => ({ ...f, bloodGroup: e.target.value }))}>
                    <option value="">— optional —</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setQuickCreate(false)}>Cancel</button>
                <button type="button" className={styles.btnPrimary} onClick={handleQuickCreate} disabled={quickSaving}>
                  {quickSaving ? 'Creating…' : 'Create & Select'}
                </button>
              </div>
            </div>
          )}

          {/* ── Rest of the form ── */}
          <div className={styles.grid2}>
            {/* Doctor */}
            <div className={styles.field}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className={styles.label} style={{ margin: 0 }}>Doctor *</label>
                {form.doctorId && (
                  <button type="button"
                    onClick={() => { localStorage.setItem(LS_PREF_DR, form.doctorId); toast.info('Default doctor saved'); }}
                    style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: localStorage.getItem(LS_PREF_DR) === form.doctorId ? '#2563eb' : '#94a3b8' }}
                    title="Pin as default doctor">
                    {localStorage.getItem(LS_PREF_DR) === form.doctorId ? '★ Default' : '☆ Set default'}
                  </button>
                )}
              </div>
              <select className={styles.input} value={form.doctorId} onChange={e => set('doctorId', e.target.value)} required>
                <option value="">Select Doctor</option>
                {doctors.map(d => {
                  const isDefault = localStorage.getItem(LS_PREF_DR) === d.id;
                  return <option key={d.id} value={d.id}>{isDefault ? '★ ' : ''}Dr. {d.name} — {d.specialization}</option>;
                })}
              </select>
            </div>

            {/* Date */}
            <div className={styles.field}>
              <label className={styles.label}>Date *</label>
              <input type="date" className={styles.input} value={form.appointmentDate}
                onChange={e => set('appointmentDate', e.target.value)} required
                min={new Date().toISOString().split('T')[0]} />
            </div>

            {/* Time — slot grid or plain input */}
            <div className={styles.field}>
              <label className={styles.label}>
                Time *
                {slots.length > 0 && (
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginLeft: 8 }}>
                    {slots.filter(s => s.available).length}/{slots.length} slots free
                  </span>
                )}
              </label>
              {slots.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, maxHeight: 160, overflowY: 'auto', paddingTop: 2 }}>
                  {slots.map(s => (
                    <button key={s.time} type="button" disabled={!s.available}
                      onClick={() => s.available && set('appointmentTime', s.time)}
                      style={{
                        padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid',
                        cursor: s.available ? 'pointer' : 'not-allowed', transition: 'all 0.12s',
                        textDecoration: !s.available ? 'line-through' : 'none',
                        background:   form.appointmentTime === s.time ? '#2563eb' : !s.available ? '#f1f5f9' : '#fff',
                        borderColor:  form.appointmentTime === s.time ? '#2563eb' : !s.available ? '#e2e8f0' : '#cbd5e1',
                        color:        form.appointmentTime === s.time ? '#fff'    : !s.available ? '#94a3b8' : '#374151',
                      }}>
                      {s.time}
                    </button>
                  ))}
                </div>
              ) : (
                <input type="time" className={styles.input} value={form.appointmentTime}
                  onChange={e => set('appointmentTime', e.target.value)} required />
              )}
            </div>

            {/* Type */}
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select className={styles.input} value={form.type} onChange={e => set('type', e.target.value)}>
                {['consultation','follow_up','emergency','routine_checkup','lab_test'].map(t =>
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>

            {/* Fee */}
            <div className={styles.field}>
              <label className={styles.label}>Fee (₹)</label>
              <input type="number" step="0.01" className={styles.input} value={form.fee} onChange={e => set('fee', e.target.value)} />
            </div>

            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Reason for Visit</label>
              <textarea className={styles.input} rows={2} value={form.reason} onChange={e => set('reason', e.target.value)} />
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Notes</label>
              <textarea className={styles.input} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          {/* Selected patient info card */}
          {selectedPatient && (
            <div style={{ marginTop: 14, border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#334155' }}>Patient Details</div>
              <div className={styles.infoGrid}>
                {[
                  ['Name', selectedPatient.name], ['Patient ID', selectedPatient.patientId],
                  ['Phone', selectedPatient.phone], ['Email', selectedPatient.email],
                  ['Gender', selectedPatient.gender], ['DOB', selectedPatient.dateOfBirth],
                  ['Blood Group', selectedPatient.bloodGroup],
                ].map(([label, value]) => (
                  <div key={label} className={styles.infoItem}>
                    <div className={styles.infoLabel}>{label}</div>
                    <div className={styles.infoValue}>{value || '—'}</div>
                  </div>
                ))}
              </div>
              {(selectedPatient.allergies || selectedPatient.medicalHistory) && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
                  {selectedPatient.allergies     && <div><strong>Allergies:</strong> {selectedPatient.allergies}</div>}
                  {selectedPatient.medicalHistory && <div><strong>Medical History:</strong> {selectedPatient.medicalHistory}</div>}
                </div>
              )}
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={!form.patientId}>Schedule</button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="Appointment Details">
        {detailModal && (
          <div>
            <div className={styles.infoGrid}>
              {[
                ['Appointment #', detailModal.appointmentNumber], ['Date', detailModal.appointmentDate],
                ['Time', detailModal.appointmentTime?.slice(0,5)], ['Patient', detailModal.patient?.name],
                ['Patient ID', detailModal.patient?.patientId],
                ['Doctor', detailModal.doctor ? `Dr. ${detailModal.doctor.name}` : '—'],
                ['Specialization', detailModal.doctor?.specialization],
                ['Type', detailModal.type], ['Fee', detailModal.fee ? `₹${detailModal.fee}` : '—'],
                ['Payment', detailModal.isPaid ? 'Paid' : 'Unpaid'],
              ].map(([label, value]) => (
                <div key={label} className={styles.infoItem}>
                  <div className={styles.infoLabel}>{label}</div>
                  <div className={styles.infoValue}>{value || '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div className={styles.infoLabel}>Status</div>
              <div style={{ marginTop: 6 }}><Badge text={detailModal.status} type={detailModal.status} /></div>
            </div>
            {detailModal.reason && (
              <div style={{ marginTop: 16 }}>
                <div className={styles.infoLabel}>Reason</div>
                <div className={styles.infoValue} style={{ marginTop: 4 }}>{detailModal.reason}</div>
              </div>
            )}
            {detailModal.diagnosis && (
              <div style={{ marginTop: 16 }}>
                <div className={styles.infoLabel}>Diagnosis</div>
                <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, marginTop: 6 }}>{detailModal.diagnosis}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
