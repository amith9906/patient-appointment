import React, { useState, useEffect } from 'react';
import { doctorAPI, hospitalAPI, departmentAPI, doctorLeaveAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultAvailabilityRule = () => ({
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  maxAppointmentsPerSlot: 1,
  notes: '',
  isActive: true,
});
const INIT = { name: '', specialization: '', qualification: '', licenseNumber: '', phone: '', email: '', experience: 0, consultationFee: 0, availableDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'], availableFrom: '09:00', availableTo: '17:00', gender: 'male', hospitalId: '', departmentId: '', bio: '' };

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [search, setSearch] = useState('');
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveDoctor, setLeaveDoctor] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ leaveDate: '', reason: '', isFullDay: true, startTime: '', endTime: '' });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [availabilityModal, setAvailabilityModal] = useState(false);
  const [availabilityDoctor, setAvailabilityDoctor] = useState(null);
  const [availabilityRules, setAvailabilityRules] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [cloneTargetId, setCloneTargetId] = useState('');
  const [cloning, setCloning] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([doctorAPI.getAll(), hospitalAPI.getAll()])
      .then(([d, h]) => { setDoctors(d.data); setHospitals(h.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    const hospitalId = hospitals.length === 1 ? hospitals[0].id : '';
    setForm({ ...INIT, hospitalId });
    if (hospitalId) loadDepts(hospitalId);
    setModal(true);
  };
  const openEdit = (doc) => {
    setEditing(doc);
    setForm({ ...doc, hospitalId: doc.hospitalId || '', departmentId: doc.departmentId || '' });
    if (doc.hospitalId) loadDepts(doc.hospitalId);
    setModal(true);
  };

  const loadDepts = (hospitalId) => {
    if (hospitalId) departmentAPI.getAll({ hospitalId }).then((r) => setDepartments(r.data));
    else setDepartments([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await doctorAPI.update(editing.id, form); toast.success('Doctor updated'); }
      else { await doctorAPI.create(form); toast.success('Doctor created'); }
      setModal(false); load();
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this doctor')) return;
    try { await doctorAPI.delete(id); toast.success('Doctor deactivated'); load(); }
    catch { toast.error('Error'); }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const toggleDay = (day) => set('availableDays', form.availableDays.includes(day) ? form.availableDays.filter(d => d !== day) : [...form.availableDays, day]);

  const openLeaves = async (doc) => {
    setLeaveDoctor(doc);
    setLeaveForm({ leaveDate: '', reason: '', isFullDay: true, startTime: '', endTime: '' });
    setLeaveLoading(true);
    setLeaveModal(true);
    try {
      const r = await doctorLeaveAPI.getAll({ doctorId: doc.id });
      setLeaves(r.data || []);
    } catch { setLeaves([]); }
    finally { setLeaveLoading(false); }
  };

  const addLeave = async (e) => {
    e.preventDefault();
    try {
      await doctorLeaveAPI.create({ ...leaveForm, doctorId: leaveDoctor.id });
      toast.success('Leave added');
      const r = await doctorLeaveAPI.getAll({ doctorId: leaveDoctor.id });
      setLeaves(r.data || []);
      setLeaveForm({ leaveDate: '', reason: '', isFullDay: true, startTime: '', endTime: '' });
    } catch (err) { toast.error(err?.response?.data?.message || 'Error'); }
  };

  const approveLeave = async (id) => {
    try {
      await doctorLeaveAPI.approve(id);
      toast.success('Leave approved');
      const r = await doctorLeaveAPI.getAll({ doctorId: leaveDoctor.id });
      setLeaves(r.data || []);
    } catch (err) { toast.error(err?.response?.data?.message || 'Error'); }
  };

  const rejectLeave = async (id) => {
    try {
      await doctorLeaveAPI.reject(id);
      toast.success('Leave rejected');
      const r = await doctorLeaveAPI.getAll({ doctorId: leaveDoctor.id });
      setLeaves(r.data || []);
    } catch (err) { toast.error(err?.response?.data?.message || 'Error'); }
  };

  const deleteLeave = async (id) => {
    if (!window.confirm('Delete this leave?')) return;
    try {
      await doctorLeaveAPI.delete(id);
      toast.success('Leave deleted');
      setLeaves(leaves.filter(l => l.id !== id));
    } catch { toast.error('Error'); }
  };

  const fetchAvailability = async (doctorId) => {
    setAvailabilityLoading(true);
    try {
      const res = await doctorAPI.getAvailability(doctorId);
      const normalized = (res.data || []).map((rule) => ({
        ...rule,
        dayOfWeek: Number(rule.dayOfWeek ?? 0),
        slotDurationMinutes: Number(rule.slotDurationMinutes ?? 30),
        bufferMinutes: Number(rule.bufferMinutes ?? 0),
        maxAppointmentsPerSlot: Number(rule.maxAppointmentsPerSlot ?? 1),
      }));
      setAvailabilityRules(normalized);
    } catch (err) {
      toast.error('Failed to load availability');
      setAvailabilityRules([]);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const openAvailability = (doc) => {
    setAvailabilityDoctor(doc);
    setAvailabilityModal(true);
    fetchAvailability(doc.id);
  };

  const closeAvailability = () => {
    setAvailabilityModal(false);
    setAvailabilityDoctor(null);
    setAvailabilityRules([]);
    setAvailabilityLoading(false);
    setAvailabilitySaving(false);
    setCloneTargetId('');
    setCloning(false);
  };

  const cloneAvailability = async () => {
    if (!cloneTargetId || availabilityRules.length === 0) return;
    const target = doctors.find(d => String(d.id) === String(cloneTargetId));
    if (!target) return;
    setCloning(true);
    const payload = (availabilityRules || []).map((rule) => ({
      dayOfWeek: Number(rule.dayOfWeek ?? 0),
      startTime: rule.startTime || '09:00',
      endTime: rule.endTime || '17:00',
      slotDurationMinutes: Number(rule.slotDurationMinutes || 30),
      bufferMinutes: Number(rule.bufferMinutes || 0),
      maxAppointmentsPerSlot: Number(rule.maxAppointmentsPerSlot || 1),
      notes: rule.notes || null,
      isActive: rule.isActive !== false,
    }));
    try {
      await doctorAPI.saveAvailability(cloneTargetId, { rules: payload });
      toast.success(`Rules cloned to Dr. ${target.name}`);
      setCloneTargetId('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to clone rules');
    } finally {
      setCloning(false);
    }
  };

  const addAvailabilityRule = () => {
    setAvailabilityRules((prev) => [...prev, defaultAvailabilityRule()]);
  };

  const updateAvailabilityRule = (index, key, value) => {
    setAvailabilityRules((prev) => prev.map((rule, idx) => (idx === index ? { ...rule, [key]: value } : rule)));
  };

  const removeAvailabilityRule = (index) => {
    setAvailabilityRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveAvailability = async () => {
    if (!availabilityDoctor) return;
    setAvailabilitySaving(true);
    const payload = (availabilityRules || []).map((rule) => ({
      dayOfWeek: Number(rule.dayOfWeek ?? 0),
      startTime: rule.startTime || '09:00',
      endTime: rule.endTime || '17:00',
      slotDurationMinutes: Number(rule.slotDurationMinutes || 30),
      bufferMinutes: Number(rule.bufferMinutes || 0),
      maxAppointmentsPerSlot: Number(rule.maxAppointmentsPerSlot || 1),
      notes: rule.notes || null,
      isActive: rule.isActive !== false,
    }));
    try {
      await doctorAPI.saveAvailability(availabilityDoctor.id, { rules: payload });
      toast.success('Availability saved');
      await fetchAvailability(availabilityDoctor.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to save availability');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isApprover = (doc) => {
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return true;
    // Check if current user is HOD of the doctor's department
    // We need to fetch the department to know its HOD. 
    // For now, we'll rely on the backend check, but we can show buttons if they might be the HOD.
    return true; // The backend will enforce if they are not actually the HOD
  };

  const filtered = doctors.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'name', label: 'Name', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.specialization}</div></div> },
    { key: 'qualification', label: 'Qualification' },
    { key: 'hospital', label: 'Hospital', render: (v) => v.name || '-' },
    { key: 'phone', label: 'Phone' },
    { key: 'consultationFee', label: 'Fee', render: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
    { key: 'isActive', label: 'Status', render: (v) => <Badge text={v ? 'Active' : 'Inactive'} type={v ? 'active' : 'inactive'} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => openEdit(r)}>Edit</button>
        <button className={styles.btnWarning} onClick={() => openLeaves(r)}>Leaves</button>
        <button className={styles.btnSecondary} onClick={() => openAvailability(r)}>Availability</button>
        <button className={styles.btnDelete} onClick={() => handleDelete(r.id)}>Deactivate</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Doctors</h2><p className={styles.pageSubtitle}>{doctors.length} doctors registered</p></div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add Doctor</button>
      </div>
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search by name or specialization..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className={styles.card}><Table columns={columns} data={filtered} loading={loading} /></div>

      {/* Leave Management Modal */}
      <Modal isOpen={leaveModal} onClose={() => setLeaveModal(false)} title={`Leaves — ${leaveDoctor?.name}`} size="lg">
        <div style={{ marginBottom: 20 }}>
          <form onSubmit={addLeave} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px', background: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
            <div className={styles.field} style={{ flex: '0 0 160px' }}>
              <label className={styles.label}>Date *</label>
              <input type="date" className={styles.input} required value={leaveForm.leaveDate} onChange={e => setLeaveForm(f => ({ ...f, leaveDate: e.target.value }))} />
            </div>
            <div className={styles.field} style={{ flex: '1 1 200px' }}>
              <label className={styles.label}>Reason</label>
              <input className={styles.input} placeholder="e.g. Conference, Personal" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className={styles.field} style={{ flex: '0 0 auto' }}>
              <label className={styles.label}>Full Day?</label>
              <input type="checkbox" checked={leaveForm.isFullDay} onChange={e => setLeaveForm(f => ({ ...f, isFullDay: e.target.checked }))} style={{ width: 20, height: 20, marginTop: 6 }} />
            </div>
            {!leaveForm.isFullDay && <>
              <div className={styles.field} style={{ flex: '0 0 120px' }}>
                <label className={styles.label}>From</label>
                <input type="time" className={styles.input} value={leaveForm.startTime} onChange={e => setLeaveForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className={styles.field} style={{ flex: '0 0 120px' }}>
                <label className={styles.label}>To</label>
                <input type="time" className={styles.input} value={leaveForm.endTime} onChange={e => setLeaveForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </>}
            <button type="submit" className={styles.btnPrimary} style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>Add Leave</button>
          </form>

          {leaveLoading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading...</div>
          ) : leaves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No leaves scheduled</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Date', 'Type', 'Time', 'Reason', 'Status', 'Approver', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{l.leaveDate}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: l.isFullDay ? '#fee2e2' : '#fef3c7', color: l.isFullDay ? '#b91c1c' : '#92400e', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {l.isFullDay ? 'Full Day' : 'Partial'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>
                      {l.isFullDay ? '—' : `${l.startTime?.slice(0,5) || '?'} – ${l.endTime?.slice(0,5) || '?'}`}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748b' }}>{l.reason || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge 
                        text={l.status?.toUpperCase() || 'PENDING'} 
                        type={l.status === 'approved' ? 'active' : l.status === 'rejected' ? 'inactive' : 'warning'} 
                      />
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 11 }}>{l.approvedBy?.name || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {l.status === 'pending' && isApprover(leaveDoctor) && (
                          <>
                            <button className={styles.btnEdit} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => approveLeave(l.id)}>Approve</button>
                            <button className={styles.btnDelete} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => rejectLeave(l.id)}>Reject</button>
                          </>
                        )}
                        <button className={styles.btnDelete} style={{ padding: '4px 8px', fontSize: 11, background: '#94a3b8' }} onClick={() => deleteLeave(l.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={availabilityModal}
        onClose={closeAvailability}
        title={`Availability — ${availabilityDoctor?.name || ''}`}
        size="xl"
      >
        {availabilityLoading ? (
          <div style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>Loading availability schedule…</div>
        ) : (
          <>
            {availabilityRules.length === 0 ? (
              <div style={{
                padding: 16, borderRadius: 12, border: '1px dashed #e2e8f0',
                color: '#475569', marginBottom: 12, textAlign: 'center',
              }}>
                No availability rules defined. Use the button below to add one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {availabilityRules.map((rule, idx) => (
                  <div key={`rule-${rule.id || idx}`} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>Day</label>
                        <select
                          className={styles.input}
                          value={rule.dayOfWeek}
                          onChange={(e) => updateAvailabilityRule(idx, 'dayOfWeek', Number(e.target.value))}
                        >
                          {DAY_NAMES.map((day, dayIndex) => (
                            <option key={dayIndex} value={dayIndex}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Start Time</label>
                        <input
                          type="time"
                          className={styles.input}
                          value={rule.startTime || '09:00'}
                          onChange={(e) => updateAvailabilityRule(idx, 'startTime', e.target.value)}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>End Time</label>
                        <input
                          type="time"
                          className={styles.input}
                          value={rule.endTime || '17:00'}
                          onChange={(e) => updateAvailabilityRule(idx, 'endTime', e.target.value)}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Slot Duration (min)</label>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          className={styles.input}
                          value={rule.slotDurationMinutes ?? 30}
                          onChange={(e) => updateAvailabilityRule(idx, 'slotDurationMinutes', Number(e.target.value))}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Buffer (min)</label>
                        <input
                          type="number"
                          min={0}
                          className={styles.input}
                          value={rule.bufferMinutes ?? 0}
                          onChange={(e) => updateAvailabilityRule(idx, 'bufferMinutes', Number(e.target.value))}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Max per slot</label>
                        <input
                          type="number"
                          min={1}
                          className={styles.input}
                          value={rule.maxAppointmentsPerSlot ?? 1}
                          onChange={(e) => updateAvailabilityRule(idx, 'maxAppointmentsPerSlot', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
                      <div className={styles.field}>
                        <label className={styles.label}>Status</label>
                        <select
                          className={styles.input}
                          value={rule.isActive ? 'active' : 'inactive'}
                          onChange={(e) => updateAvailabilityRule(idx, 'isActive', e.target.value === 'active')}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className={styles.field} style={{ gridColumn: 'span 2' }}>
                        <label className={styles.label}>Notes</label>
                        <input
                          className={styles.input}
                          placeholder="Optional reminder for this rule"
                          value={rule.notes || ''}
                          onChange={(e) => updateAvailabilityRule(idx, 'notes', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" className={styles.btnDelete} onClick={() => removeAvailabilityRule(idx)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <button type="button" className={styles.btnSecondary} onClick={addAvailabilityRule}>+ Add rule</button>
            </div>

            {/* Clone to another doctor */}
            {availabilityRules.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Clone Rules to Another Doctor
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className={styles.filterSelect}
                    value={cloneTargetId}
                    onChange={(e) => setCloneTargetId(e.target.value)}
                    style={{ flex: '1 1 200px', minWidth: 180 }}
                  >
                    <option value="">Select doctor…</option>
                    {doctors
                      .filter((d) => d.id !== availabilityDoctor?.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialization}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={cloneAvailability}
                    disabled={!cloneTargetId || cloning}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {cloning ? 'Cloning…' : 'Clone Rules'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  This will replace the selected doctor's availability with the current rules.
                </div>
              </div>
            )}
          </>
        )}
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} onClick={closeAvailability}>Close</button>
          <button type="button" className={styles.btnPrimary} onClick={saveAvailability} disabled={availabilitySaving}>
            {availabilitySaving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Doctor' : 'Add Doctor'} size="xl">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}><label className={styles.label}>Full Name *</label><input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Specialization *</label><input className={styles.input} value={form.specialization} onChange={(e) => set('specialization', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Qualification</label><input className={styles.input} value={form.qualification || ''} onChange={(e) => set('qualification', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>License Number</label><input className={styles.input} value={form.licenseNumber || ''} onChange={(e) => set('licenseNumber', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Phone</label><input className={styles.input} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Email</label><input className={styles.input} type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Experience (years)</label><input className={styles.input} type="number" value={form.experience} onChange={(e) => set('experience', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Consultation Fee ($)</label><input className={styles.input} type="number" step="0.01" value={form.consultationFee} onChange={(e) => set('consultationFee', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Available From</label><input className={styles.input} type="time" value={form.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Available To</label><input className={styles.input} type="time" value={form.availableTo} onChange={(e) => set('availableTo', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Gender</label>
              <select className={styles.input} value={form.gender || 'male'} onChange={(e) => set('gender', e.target.value)}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Hospital (Optional)</label>
              <SearchableSelect
                className={styles.input}
                value={form.hospitalId || ''}
                onChange={(v) => { set('hospitalId', v); loadDepts(v); }}
                placeholder="Search hospital"
                emptyLabel="Select Hospital"
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
              />
            </div>
            <div className={styles.field}><label className={styles.label}>Department (Optional)</label>
              <SearchableSelect
                className={styles.input}
                value={form.departmentId || ''}
                onChange={(v) => set('departmentId', v)}
                placeholder="Search department"
                emptyLabel="Select Department"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Available Days</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {DAYS.map(day => (
                  <button key={day} type="button"
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: form.availableDays.includes(day) ? '#2563eb' : '#f8fafc',
                      color: form.availableDays.includes(day) ? '#fff' : '#475569',
                      borderColor: form.availableDays.includes(day) ? '#2563eb' : '#d1d5db' }}
                    onClick={() => toggleDay(day)}>{day.slice(0, 3)}</button>
                ))}
              </div>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Bio</label><textarea className={styles.input} rows={3} value={form.bio || ''} onChange={(e) => set('bio', e.target.value)} /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
