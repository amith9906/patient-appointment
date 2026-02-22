import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentAPI, doctorAPI, packageAPI, patientAPI, doctorLeaveAPI } from '../services/api';
import { exportToCSV } from '../utils/exportCsv';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import CalendarView from '../components/CalendarView';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import PaginationControls from '../components/PaginationControls';

const INIT = {
  patientId: '', doctorId: '', appointmentDate: '', appointmentTime: '', type: 'consultation',
  reason: '', notes: '', fee: '', referralSource: '', referralDetail: '', patientPackageId: '',
};
const STATUSES = ['scheduled', 'postponed', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
const LS_SMART   = 'appt_smart_defaults';
const LS_PREF_DR = 'appt_preferred_doctor';
const LS_AUTO_PKG_CHECKIN = 'appt_auto_package_checkin';
const QUICK_INIT = { name: '', phone: '', gender: 'male', dateOfBirth: '', bloodGroup: '' };

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  postponed: 'Postponed',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Skipped',
};
const QUEUE_STATUSES = ['scheduled', 'postponed', 'confirmed', 'in_progress'];
const TODAY_STR = new Date().toISOString().split('T')[0];

export default function Appointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [patients, setPatients]         = useState([]);
  const [patientPackages, setPatientPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [slots, setSlots]               = useState([]);
  const [leaveWarning, setLeaveWarning] = useState(null);
  const [availableDoctorIds, setAvailableDoctorIds] = useState(null); // null = not checked yet
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [bulkLoading, setBulkLoading]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(false);
  const [detailModal, setDetailModal]   = useState(null);
  const [actionModal, setActionModal]   = useState(null);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(INIT);
  const [filters, setFilters]           = useState({ status: '', date: '', patientName: '', patientPhone: '' });
  const [page, setPage]                 = useState(1);
  const [perPage, setPerPage]           = useState(25);
  const [pagination, setPagination]     = useState(null);
  const [actionNotes, setActionNotes]   = useState('');
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeTime, setPostponeTime] = useState('');

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
  const [autoPackageOnCheckIn, setAutoPackageOnCheckIn] = useState(() => localStorage.getItem(LS_AUTO_PKG_CHECKIN) !== 'false');

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

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      page,
      per_page: perPage,
    };
    if (filters.status) params.status = filters.status;
    if (filters.date) params.date = filters.date;
    if (filters.patientName.trim()) params.patientName = filters.patientName.trim();
    if (filters.patientPhone.trim()) params.patientPhone = filters.patientPhone.trim();
    Promise.all([
      appointmentAPI.getAll(params),
      doctorAPI.getAll(),
      patientAPI.getAll({ paginate: 'false' }),
    ])
      .then(([a, d, p]) => {
        setAppointments(a.data);
        setPagination(a.pagination || null);
        setDoctors(d.data);
        setPatients(p.data);
      })
      .finally(() => setLoading(false));
  }, [filters.status, filters.date, filters.patientName, filters.patientPhone, page, perPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.status, filters.date, filters.patientName, filters.patientPhone]);

  useEffect(() => {
    if (form.patientId) loadPatientAssignments(form.patientId);
    else setPatientPackages([]);
  }, [form.patientId]);

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

  // -- Form helpers ------------------------------------------------------------
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
      if (doc.consultationFee) updated.fee = String(doc.consultationFee);
    }
    setForm(updated);
    if (k === 'doctorId' || k === 'appointmentDate') loadSlots(updated.doctorId, updated.appointmentDate);
    if (k === 'appointmentDate' && v) loadAvailableDoctors(v);
  };

  const loadAvailableDoctors = async (date) => {
    if (!date) { setAvailableDoctorIds(null); return; }
    try {
      const res = await doctorAPI.getAvailableOnDate(date);
      setAvailableDoctorIds(new Set(res.data.availableDoctorIds));
    } catch { setAvailableDoctorIds(null); }
  };

  const loadSlots = async (doctorId, date) => {
    if (!doctorId || !date) return;
    try { const res = await doctorAPI.getSlots(doctorId, date); setSlots(res.data); }
    catch { setSlots([]); }
    // Check leave
    try {
      const lr = await doctorLeaveAPI.checkLeave(doctorId, date);
      setLeaveWarning(lr.data?.onLeave ? lr.data.leave : null);
    } catch { setLeaveWarning(null); }
  };

  const loadPatientAssignments = async (patientId) => {
    if (!patientId) {
      setPatientPackages([]);
      return;
    }
    setPackagesLoading(true);
    try {
      const res = await packageAPI.getPatientAssignments(patientId, { status: 'active' });
      setPatientPackages(res.data || []);
    } catch {
      setPatientPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (editing) { await appointmentAPI.update(editing.id, payload); toast.success('Appointment updated'); }
      else {
        await appointmentAPI.create(payload);
        toast.success('Appointment scheduled');
        if (form.doctorId) localStorage.setItem(LS_PREF_DR, form.doctorId);
      }

      if (form.patientId && (form.referralSource || form.referralDetail)) {
        try {
          await patientAPI.update(form.patientId, {
            referralSource: form.referralSource || null,
            referralDetail: form.referralDetail || null,
          });
        } catch {}
      }
      setModal(false);
      load();
      refreshCalendar();
      loadPatientAssignments(form.patientId);
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const handleStatus = async (id, status) => {
    try { await appointmentAPI.update(id, { status }); toast.success(`Status updated to ${status}`); load(); }
    catch { toast.error('Error'); }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    const selectable = appointments.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status));
    if (selectable.every((a) => selectedIds.has(a.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((a) => a.id)));
    }
  };

  const handleBulkComplete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    let done = 0;
    for (const id of selectedIds) {
      try { await appointmentAPI.update(id, { status: 'completed' }); done++; } catch {}
    }
    setBulkLoading(false);
    setSelectedIds(new Set());
    toast.success(`${done} appointment${done !== 1 ? 's' : ''} marked as completed`);
    load();
  };

  const handleBulkCancel = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Cancel ${selectedIds.size} appointment(s)?`)) return;
    setBulkLoading(true);
    let done = 0;
    for (const id of selectedIds) {
      try { await appointmentAPI.update(id, { status: 'cancelled' }); done++; } catch {}
    }
    setBulkLoading(false);
    setSelectedIds(new Set());
    toast.success(`${done} appointment${done !== 1 ? 's' : ''} cancelled`);
    load();
  };

  const handleCheckIn = async (appt) => {
    try {
      const res = await appointmentAPI.checkIn(appt.id);
      const pos = res.data?.queuePosition;
      toast.success(pos ? `Checked in. Queue token #${pos}` : 'Checked in successfully');

      if (autoPackageOnCheckIn && appt?.patient?.id) {
        try {
          const recRes = await packageAPI.getRecommendation({
            patientId: appt.patient.id,
            appointmentType: appt.type || '',
          });
          const eligible = recRes.data?.recommended || null;
          if (eligible) {
            const ok = window.confirm(`Recommended package: ${eligible.plan?.name || 'Package'} (${eligible.usedVisits}/${eligible.totalVisits} used, fit ${eligible.fitScore}/4). Apply one visit now?`);
            if (ok) {
              await packageAPI.consumeVisit(eligible.id, {
                appointmentId: appt.id,
                notes: 'Applied from check-in workflow',
              });
              toast.success('Package visit applied on check-in');
            }
          }
        } catch {}
      }

      load();
      refreshCalendar();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Check-in failed');
    }
  };

  const openActionModal = (type, appt) => {
    setActionNotes('');
    setActionModal({ type, appt });
    if (type === 'postpone') {
      const base = new Date(`${appt.appointmentDate}T00:00:00`);
      const nextDay = new Date(base);
      nextDay.setDate(base.getDate() + 1);
      setPostponeDate(nextDay.toISOString().slice(0, 10));
      setPostponeTime((appt.appointmentTime || '').slice(0, 5));
    }
  };

  const closeActionModal = () => {
    setActionModal(null);
    setActionNotes('');
    setPostponeDate('');
    setPostponeTime('');
  };

  const handleActionSubmit = async () => {
    if (!actionModal?.appt) return;
    const appt = actionModal.appt;
    try {
      if (actionModal.type === 'skip') {
        await appointmentAPI.update(appt.id, {
          status: 'no_show',
          notes: actionNotes.trim() ? `Skipped: ${actionNotes.trim()}` : 'Skipped by staff',
        });
        toast.success('Appointment marked as skipped');
      }

      if (actionModal.type === 'cancel') {
        if (!actionNotes.trim()) return toast.error('Cancellation reason is required');
        await appointmentAPI.cancel(appt.id, actionNotes.trim());
        toast.success('Appointment cancelled');
      }

      if (actionModal.type === 'postpone') {
        if (!postponeDate || !postponeTime) return toast.error('Please select postponed date and time');
        const postponeReason = actionNotes.trim()
          ? `Postponed: ${actionNotes.trim()}`
          : `Postponed from ${appt.appointmentDate} ${String(appt.appointmentTime || '').slice(0, 5)}`;
        await appointmentAPI.update(appt.id, {
          appointmentDate: postponeDate,
          appointmentTime: postponeTime,
          status: 'postponed',
          notes: postponeReason,
        });
        toast.success('Appointment postponed');
      }

      closeActionModal();
      load();
      refreshCalendar();
    } catch (err) {
      toast.error(err.response.data.message || 'Error');
    }
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

  // -- Patient typeahead --------------------------------------------------------
  const selectedPatient = patients.find(p => p.id === form.patientId);
  const activePackages = patientPackages || [];
  const selectedPackage = activePackages.find((pkg) => pkg.id === form.patientPackageId);

  const typeaheadPatients = (() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients.filter(p =>
      [p.name, p.patientId, p.phone, p.email].filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    ).slice(0, 8);
  })();

  const selectPatient = (p) => {
    setForm(f => ({
      ...f,
      patientId: p.id,
      referralSource: p.referralSource || f.referralSource || '',
      referralDetail: p.referralDetail || f.referralDetail || '',
      patientPackageId: '',
    }));
    setPatientQuery('');
    setPatientDropOpen(false);
    setQuickCreate(false);
  };

  const clearPatient = () => {
    setForm(f => ({ ...f, patientId: '', referralSource: '', referralDetail: '' }));
    setPatientQuery('');
    setPatientDropOpen(false);
  };

  const queueDateForView = filters.date || TODAY_STR;
  const queueTokenById = useMemo(() => {
    const map = {};
    appointments
      .filter((a) => a.appointmentDate === queueDateForView && QUEUE_STATUSES.includes(a.status))
      .sort((a, b) => {
        const ta = String(a.appointmentTime || '');
        const tb = String(b.appointmentTime || '');
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return 0;
      })
      .forEach((a, idx) => { map[a.id] = idx + 1; });
    return map;
  }, [appointments, queueDateForView]);

  // -- Quick-create new patient -------------------------------------------------
  const handleQuickCreate = async () => {
    if (!quickForm.name.trim()) return toast.error('Name is required');
    if (!quickForm.phone.trim()) return toast.error('Phone is required');
    setQuickSaving(true);
    try {
      const payload = { ...quickForm };
      // For non-super-admin, backend fills hospitalId from scope.
      // For super-admin, pick from first doctor's hospital if available.
      if (!payload.hospitalId) payload.hospitalId = doctors?.[0]?.hospitalId || '';
      const res = await patientAPI.create(payload);
      const newPat = res.data;
      setPatients(prev => [newPat, ...prev]);
      selectPatient(newPat);
      toast.success(`Patient "${newPat.name}" created and selected`);
      setQuickForm(QUICK_INIT);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to create patient');
    } finally { setQuickSaving(false); }
  };

  // -- CSV Export ---------------------------------------------------------------
  const [exporting, setExporting] = useState(false);
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = { paginate: 'false' };
      if (filters.status) params.status = filters.status;
      if (filters.date) params.date = filters.date;
      if (filters.patientName.trim()) params.patientName = filters.patientName.trim();
      if (filters.patientPhone.trim()) params.patientPhone = filters.patientPhone.trim();
      const res = await appointmentAPI.getAll(params);
      const rows = res.data || [];
      const csvCols = [
        { label: 'Apt #', key: (r) => r.appointmentNumber || '' },
        { label: 'Date', key: (r) => r.appointmentDate || '' },
        { label: 'Time', key: (r) => (r.appointmentTime || '').slice(0, 5) },
        { label: 'Patient', key: (r) => r.patient?.name || '' },
        { label: 'Patient ID', key: (r) => r.patient?.patientId || '' },
        { label: 'Phone', key: (r) => r.patient?.phone || '' },
        { label: 'Doctor', key: (r) => r.doctor ? `Dr. ${r.doctor.name}` : '' },
        { label: 'Type', key: (r) => r.type || '' },
        { label: 'Status', key: (r) => STATUS_LABEL[r.status] || r.status || '' },
        { label: 'Fee (Rs)', key: (r) => r.fee || 0 },
        { label: 'Billing Type', key: (r) => r.billingType || '' },
        { label: 'Paid', key: (r) => r.isPaid ? 'Yes' : 'No' },
        { label: 'Package', key: (r) => r.packageAssignment?.plan?.name || '' },
        { label: 'Reason', key: (r) => r.reason || '' },
        { label: 'Notes', key: (r) => r.notes || '' },
      ];
      exportToCSV(rows, csvCols, 'appointments');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // -- Table columns ------------------------------------------------------------
  const selectableAppointments = appointments.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status));
  const allSelected = selectableAppointments.length > 0 && selectableAppointments.every((a) => selectedIds.has(a.id));

  const columns = [
    {
      key: 'id',
      label: (
        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
          title="Select all selectable" style={{ cursor: 'pointer' }} />
      ),
      render: (_, r) => {
        const isSelectable = !['cancelled', 'no_show', 'completed'].includes(r.status);
        return isSelectable
          ? <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ cursor: 'pointer' }} />
          : null;
      },
    },
    { key: 'appointmentNumber', label: 'Apt #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { key: 'appointmentDate',   label: 'Date' },
    { key: 'appointmentTime',   label: 'Time', render: (v) => v.slice(0, 5) },
    {
      key: 'queueToken',
      label: 'Queue',
      render: (_, r) => (
        queueTokenById[r.id]
          ? <span style={{ fontWeight: 700, color: '#0f766e' }}>#{queueTokenById[r.id]}</span>
          : '-'
      ),
    },
    {
      key: 'patient',
      label: 'Patient',
      render: (v) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {v.patientId}{v.phone ? ` | ${v.phone}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'doctor',  label: 'Doctor',  render: (v) => v ? `Dr. ${v.name}` : '-'},
    { key: 'type',    label: 'Type',    render: (v) => <Badge text={v} type="default" /> },
    { key: 'packageAssignment', label: 'Package', render: (v) => v?.plan?.name ? `${v.plan.name} (${v.status || 'active'})` : '-' },
    { key: 'status',  label: 'Status',  render: (v) => <Badge text={STATUS_LABEL[v] || v} type={v} /> },
    { key: 'isPaid',  label: 'Payment', render: (v) => <Badge text={v ? 'Paid' : 'Unpaid'} type={v ? 'active' : 'inactive'} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => navigate(`/appointments/${r.id}`)}>View / Edit</button>
        {['scheduled', 'postponed'].includes(r.status) && (
          <button className={styles.btnPrimary} onClick={() => handleCheckIn(r)}>Check-In</button>
        )}
        {['scheduled', 'postponed'].includes(r.status) && <button className={styles.btnSuccess} onClick={() => handleStatus(r.id, 'confirmed')}>Confirm</button>}
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
        {!['cancelled','completed','no_show'].includes(r.status) && (
          <button className={styles.btnWarning} onClick={() => openActionModal('postpone', r)}>Postpone</button>
        )}
        {!['cancelled','completed','no_show'].includes(r.status) && (
          <button className={styles.btnSecondary} onClick={() => openActionModal('skip', r)}>Skipped</button>
        )}
        {!['cancelled','completed','no_show'].includes(r.status) && (
          <button className={styles.btnDelete} onClick={() => openActionModal('cancel', r)}>Cancel</button>
        )}
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
            {[['list','List'],['calendar','Calendar']].map(([v, label]) => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background:viewMode === v ? '#2563eb' : '#fff', color:viewMode === v ? '#fff' : '#64748b', transition: 'background 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={openCreate}>+ Schedule Appointment</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
            <input
              type="checkbox"
              checked={autoPackageOnCheckIn}
              onChange={(e) => {
                const v = e.target.checked;
                setAutoPackageOnCheckIn(v);
                localStorage.setItem(LS_AUTO_PKG_CHECKIN, v ? 'true' : 'false');
              }}
            />
            Suggest package use on check-in
          </label>
        </div>
      </div>

      {/* -- LIST VIEW -- */}
      {viewMode === 'list' && (
        <>
          <div className={styles.filterBar}>
            <input type="date" className={styles.filterSelect} value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} />
            <input
              className={styles.searchInput}
              placeholder="Filter by patient name"
              value={filters.patientName}
              onChange={e => setFilters({ ...filters, patientName: e.target.value })}
              style={{ minWidth: 220 }}
            />
            <input
              className={styles.searchInput}
              placeholder="Filter by mobile number"
              value={filters.patientPhone}
              onChange={e => setFilters({ ...filters, patientPhone: e.target.value })}
              style={{ minWidth: 220 }}
            />
            <select className={styles.filterSelect} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>)}
            </select>
            <button
              className={styles.btnSecondary}
              onClick={() => setFilters({ ...filters, date: TODAY_STR, status: '' })}
            >
              Today Queue
            </button>
            <button className={styles.btnSecondary} onClick={() => setFilters({ status: '', date: '', patientName: '', patientPhone: '' })}>Clear</button>
            <button className={styles.btnSecondary} onClick={handleExportCSV} disabled={exporting} title="Export filtered appointments to CSV">
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#1e40af' }}>{selectedIds.size} selected</span>
              <button className={styles.btnSuccess} onClick={handleBulkComplete} disabled={bulkLoading} style={{ fontSize: 12, padding: '5px 14px' }}>
                {bulkLoading ? 'Processing...' : 'Mark All Completed'}
              </button>
              <button className={styles.btnWarning} onClick={handleBulkCancel} disabled={bulkLoading} style={{ fontSize: 12, padding: '5px 14px' }}>
                Cancel All
              </button>
              <button className={styles.btnSecondary} onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, padding: '5px 14px' }}>
                Clear Selection
              </button>
            </div>
          )}
          <div className={styles.card}>
            <Table columns={columns} data={appointments} loading={loading} />
            <PaginationControls
              meta={pagination}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPerPageChange={(value) => {
                setPerPage(value);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      {/* -- CALENDAR VIEW -- */}
      {viewMode === 'calendar' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Filter by Doctor:</label>
            <SearchableSelect
              className={styles.filterSelect}
              style={{ minWidth: 200 }}
              value={calendarDoctorFilter}
              onChange={setCalendarDoctorFilter}
              options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name} - ${d.specialization}` }))}
              placeholder="Search doctor..."
              emptyLabel="All Doctors"
            />
          </div>
          <CalendarView appointments={calendarAppointments} view={calendarView} currentDate={calendarDate}
            onNavigate={setCalendarDate} onViewChange={setCalendarView} onAppointmentClick={a => navigate(`/appointments/${a.id}`)}
            showDoctor={true} loading={calendarLoading} />
        </div>
      )}

      {/* -- Schedule Appointment Modal -- */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Schedule Appointment" size="lg">
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Smart defaults toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Smart Defaults</span>
            <button type="button" onClick={() => toggleSmartDefaults(!smartDefaults)}
              title={smartDefaults ? 'Auto-selects doctor & fills fee' : 'Smart defaults off'}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center',
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                background:smartDefaults ? '#2563eb' : '#d1d5db', transition: 'background 0.2s', padding: 0 }}>
              <span style={{ display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transform:smartDefaults ? 'translateX(18px)' : 'translateX(2px)' }} />
            </button>
            <span style={{ fontSize: 11, color:smartDefaults ? '#2563eb' : '#94a3b8', fontWeight: 500, minWidth: 20 }}>
              {smartDefaults ? 'On' : 'Off'}
            </span>
          </div>

          {/* -- Patient Combobox -- */}
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
                    {selectedPatient.phone && ` | ${selectedPatient.phone}`}
                    {selectedPatient.bloodGroup && ` | ${selectedPatient.bloodGroup}`}
                  </div>
                </div>
                <button type="button" onClick={clearPatient}
                  style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px' }}
                  title="Change patient">X</button>
              </div>
            ) : (
              <input
                className={styles.input}
                value={patientQuery}
                autoComplete="off"
                placeholder="Type name, ID or phone to search..."
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
                        {p.phone && ` | ${p.phone}`}
                        {p.gender && ` | ${p.gender}`}
                        {p.bloodGroup && ` | ${p.bloodGroup}`}
                      </div>
                    </button>
                  ))
                )}

                {/* -- New Patient option -- */}
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

          {activePackages.length > 0 && (
            <div className={styles.field} style={{ marginBottom: 14 }}>
              <label className={styles.label}>Use Package (optional)</label>
              <select
                className={styles.input}
                value={form.patientPackageId}
                onChange={(e) => set('patientPackageId', e.target.value)}
              >
                <option value="">Do not attach a package</option>
                {activePackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.plan?.name || 'Package'} — {pkg.usedVisits}/{pkg.totalVisits} used
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {!selectedPackage && packagesLoading && 'Loading packages...'}
                {selectedPackage && (
                  <>
                    {Math.max(selectedPackage.totalVisits - selectedPackage.usedVisits, 0)} visits remaining
                    {selectedPackage.expiryDate ? ` • Expires ${selectedPackage.expiryDate}` : ''}
                  </>
                )}
              </div>
            </div>
          )}

          {/* -- Quick-create new patient form -- */}
          {quickCreate && (
            <div style={{ border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, background: '#eff6ff', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>+ New Patient</span>
                <button type="button" onClick={() => setQuickCreate(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 18, lineHeight: 1 }}>X</button>
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
                    <option value="">- optional -</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setQuickCreate(false)}>Cancel</button>
                <button type="button" className={styles.btnPrimary} onClick={handleQuickCreate} disabled={quickSaving}>
                  {quickSaving ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </div>
          )}

          {/* -- Rest of the form -- */}
          <div className={styles.grid2}>
            {/* Doctor */}
            <div className={styles.field}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className={styles.label} style={{ margin: 0 }}>Doctor *</label>
                {form.doctorId && (
                  <button type="button"
                    onClick={() => { localStorage.setItem(LS_PREF_DR, form.doctorId); toast.info('Default doctor saved'); }}
                    style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: localStorage.getItem(LS_PREF_DR) === form.doctorId ? '#2563eb' : '#94a3b8'}}
                    title="Pin as default doctor">
                    {localStorage.getItem(LS_PREF_DR) === form.doctorId ? '* Default' : 'o Set default'}
                  </button>
                )}
              </div>
              <SearchableSelect
                className={styles.input}
                value={form.doctorId}
                onChange={(value) => set('doctorId', value)}
                options={doctors.map((d) => {
                  const isDefault = localStorage.getItem(LS_PREF_DR) === d.id;
                  const unavailable = form.appointmentDate && availableDoctorIds !== null && !availableDoctorIds.has(d.id);
                  return {
                    value: d.id,
                    label: `${isDefault ? '* ' : ''}Dr. ${d.name} - ${d.specialization}${unavailable ? ' (unavailable)' : ''}`,
                  };
                })}
                placeholder="Search doctor..."
                emptyLabel="Select Doctor"
                required
              />
              {form.appointmentDate && availableDoctorIds !== null && form.doctorId && !availableDoctorIds.has(form.doctorId) && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                  This doctor has no schedule on the selected date.
                </div>
              )}
            </div>

            {/* Date */}
            <div className={styles.field}>
              <label className={styles.label}>Date *</label>
              <input type="date" className={styles.input} value={form.appointmentDate}
                onChange={e => set('appointmentDate', e.target.value)} required
                min={!editing ? TODAY_STR : undefined} />
              {leaveWarning && (
                <div style={{ marginTop: 6, padding: '7px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                  ⚠ Doctor is on leave this day
                  {leaveWarning.reason ? ` — ${leaveWarning.reason}` : ''}
                  {!leaveWarning.isFullDay && leaveWarning.startTime
                    ? ` (${leaveWarning.startTime.slice(0,5)}–${leaveWarning.endTime?.slice(0,5) || '?'})` : ''}
                </div>
              )}
            </div>

            {/* Time - slot grid or plain input */}
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
                        cursor:s.available ? 'pointer' : 'not-allowed', transition: 'all 0.12s',
                        textDecoration:!s.available ? 'line-through' : 'none',
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
              <label className={styles.label}>Fee (Rs)</label>
              <input type="number" step="0.01" min={0} className={styles.input} value={form.fee} onChange={e => set('fee', e.target.value)} />
            </div>

            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Reason for Visit</label>
              <textarea className={styles.input} rows={2} value={form.reason} onChange={e => set('reason', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Referral Source</label>
              <select className={styles.input} value={form.referralSource || ''} onChange={e => set('referralSource', e.target.value)}>
                <option value="">Select</option>
                {['Walk-in', 'Google', 'Website', 'Doctor Referral', 'Friend/Family', 'Insurance', 'Corporate', 'Camp', 'Social Media', 'Other'].map((src) => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Referral Detail</label>
              <input className={styles.input} value={form.referralDetail || ''} onChange={e => set('referralDetail', e.target.value)} placeholder="Doctor name / campaign / notes" />
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
                  ['Referral', selectedPatient.referralSource],
                ].map(([label, value]) => (
                  <div key={label} className={styles.infoItem}>
                    <div className={styles.infoLabel}>{label}</div>
                    <div className={styles.infoValue}>{value || '-'}</div>
                  </div>
                ))}
              </div>
              {activePackages.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className={styles.infoLabel}>Active Packages</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {activePackages.map((pkg) => (
                      <span key={pkg.id} style={{
                        padding: '4px 10px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontSize: 11, fontWeight: 600,
                      }}>
                        {pkg.plan?.name || 'Package'} • {Math.max(pkg.totalVisits - pkg.usedVisits, 0)} remaining
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(selectedPatient.allergies || selectedPatient.medicalHistory) && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
                  {selectedPatient.allergies     && <div><strong>Allergies:</strong> {selectedPatient.allergies}</div>}
                  {selectedPatient.medicalHistory && <div><strong>Medical History:</strong> {selectedPatient.medicalHistory}</div>}
                </div>
              )}
              {Array.isArray(selectedPatient.chronicConditions) && selectedPatient.chronicConditions.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Chronic Conditions</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedPatient.chronicConditions.map((c) => (
                      <span key={c} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(selectedPatient.clinicalAlerts) && selectedPatient.clinicalAlerts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Clinical Alerts</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedPatient.clinicalAlerts.map((a) => (
                      <span key={a} style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>
                        {a}
                      </span>
                    ))}
                  </div>
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

      {/* -- Detail Modal -- */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="Appointment Details">
        {detailModal && (
          <div>
            <div className={styles.infoGrid}>
              {[
                ['Appointment #', detailModal.appointmentNumber], ['Date', detailModal.appointmentDate],
                ['Time', detailModal.appointmentTime.slice(0,5)], ['Patient', detailModal.patient.name],
                ['Patient ID', detailModal.patient.patientId],
                ['Doctor', detailModal.doctor ? `Dr. ${detailModal.doctor.name}` : '-'],
                ['Specialization', detailModal.doctor.specialization],
                ['Type', detailModal.type], ['Fee', detailModal.fee ? `Rs ${detailModal.fee}` : '-'],
                ['Payment', detailModal.isPaid ? 'Paid' : 'Unpaid'],
              ].map(([label, value]) => (
                <div key={label} className={styles.infoItem}>
                  <div className={styles.infoLabel}>{label}</div>
                  <div className={styles.infoValue}>{value || '-'}</div>
                </div>
              ))}
            </div>
            {detailModal.packageAssignment?.plan && (
              <div style={{ marginTop: 16 }}>
                <div className={styles.infoLabel}>Package</div>
                <div className={styles.infoValue}>
                  {detailModal.packageAssignment.plan.name} — {detailModal.packageAssignment.usedVisits}/{detailModal.packageAssignment.totalVisits} used
                </div>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div className={styles.infoLabel}>Status</div>
              <div style={{ marginTop: 6 }}><Badge text={STATUS_LABEL[detailModal.status] || detailModal.status} type={detailModal.status} /></div>
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

      <Modal
        isOpen={!!actionModal}
        onClose={closeActionModal}
        title={
          actionModal?.type === 'skip'
            ? 'Mark Appointment as Skipped'
            : actionModal?.type === 'postpone'
              ? 'Postpone Appointment'
              : 'Cancel Appointment'
        }
        size="md"
      >
        {actionModal?.appt && (
          <div className={styles.form}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                {actionModal.appt.patient.name} ({actionModal.appt.patient.phone || 'No mobile'})
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                {actionModal.appt.appointmentDate} {String(actionModal.appt.appointmentTime || '').slice(0, 5)} | Dr. {actionModal.appt.doctor.name || '-'}
              </div>
            </div>

            {actionModal.type === 'postpone' && (
              <div className={styles.grid2} style={{ marginBottom: 12 }}>
                <div className={styles.field}>
                  <label className={styles.label}>New Date *</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={postponeDate}
                    onChange={(e) => setPostponeDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>New Time *</label>
                  <input
                    type="time"
                    className={styles.input}
                    value={postponeTime}
                    onChange={(e) => setPostponeTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>
                {actionModal.type === 'cancel' ? 'Cancellation Reason *' : 'Details / Reason'}
              </label>
              <textarea
                className={styles.input}
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionModal.type === 'skip'
                    ? 'Why was this appointment skipped'
                    : actionModal.type === 'postpone'
                      ? 'Reason for postponing to next/selected date'
                      : 'Reason for cancellation'
                }
              />
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={closeActionModal}>Close</button>
              {actionModal.type === 'postpone' && (
                <button
                  type="button"
                  className={styles.btnWarning}
                  onClick={() => {
                    const d = new Date(`${actionModal.appt.appointmentDate}T00:00:00`);
                    d.setDate(d.getDate() + 1);
                    setPostponeDate(d.toISOString().slice(0, 10));
                  }}
                >
                  Next Day
                </button>
              )}
              <button
                type="button"
                className={actionModal.type === 'cancel' ? styles.btnDelete : styles.btnPrimary}
                onClick={handleActionSubmit}
              >
                {actionModal.type === 'skip' ? 'Mark Skipped' : actionModal.type === 'postpone' ? 'Postpone' : 'Cancel Appointment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
