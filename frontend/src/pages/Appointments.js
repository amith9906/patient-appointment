import React, { useState, useEffect } from 'react';
import { appointmentAPI, doctorAPI, patientAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT = { patientId: '', doctorId: '', appointmentDate: '', appointmentTime: '', type: 'consultation', reason: '', notes: '', fee: '' };
const STATUSES = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [filters, setFilters] = useState({ status: '', date: '' });
  const [patientSearch, setPatientSearch] = useState('');

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.date) params.date = filters.date;
    Promise.all([appointmentAPI.getAll(params), doctorAPI.getAll(), patientAPI.getAll()])
      .then(([a, d, p]) => { setAppointments(a.data); setDoctors(d.data); setPatients(p.data); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  const openCreate = () => { setEditing(null); setForm(INIT); setSlots([]); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await appointmentAPI.update(editing.id, form); toast.success('Appointment updated'); }
      else { await appointmentAPI.create(form); toast.success('Appointment scheduled'); }
      setModal(false); load();
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

  const loadSlots = async (doctorId, date) => {
    if (!doctorId || !date) return;
    try { const res = await doctorAPI.getSlots(doctorId, date); setSlots(res.data); }
    catch { setSlots([]); }
  };

  const set = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    if (k === 'doctorId' || k === 'appointmentDate') loadSlots(updated.doctorId, updated.appointmentDate);
  };

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return [p.name, p.patientId, p.phone, p.email].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
  });

  const selectedPatient = patients.find((p) => p.id === form.patientId);

  const columns = [
    { key: 'appointmentNumber', label: 'Apt #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { key: 'appointmentDate', label: 'Date' },
    { key: 'appointmentTime', label: 'Time', render: (v) => v?.slice(0, 5) },
    { key: 'patient', label: 'Patient', render: (v) => <div><div style={{ fontWeight: 600 }}>{v?.name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{v?.patientId}</div></div> },
    { key: 'doctor', label: 'Doctor', render: (v) => v ? `Dr. ${v.name}` : '—' },
    { key: 'type', label: 'Type', render: (v) => <Badge text={v} type="default" /> },
    { key: 'status', label: 'Status', render: (v) => <Badge text={v} type={v} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => setDetailModal(r)}>View</button>
        {r.status === 'scheduled' && <button className={styles.btnSuccess} onClick={() => handleStatus(r.id, 'confirmed')}>Confirm</button>}
        {r.status === 'confirmed' && <button className={styles.btnWarning} onClick={() => handleStatus(r.id, 'in_progress')}>Start</button>}
        {r.status === 'in_progress' && <button className={styles.btnSuccess} onClick={() => handleStatus(r.id, 'completed')}>Complete</button>}
        {!['cancelled', 'completed', 'no_show'].includes(r.status) && <button className={styles.btnDelete} onClick={() => handleCancel(r.id)}>Cancel</button>}
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Appointments</h2><p className={styles.pageSubtitle}>{appointments.length} appointments</p></div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Schedule Appointment</button>
      </div>
      <div className={styles.filterBar}>
        <input type="date" className={styles.filterSelect} value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <select className={styles.filterSelect} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button className={styles.btnSecondary} onClick={() => setFilters({ status: '', date: '' })}>Clear</button>
      </div>
      <div className={styles.card}><Table columns={columns} data={appointments} loading={loading} /></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Schedule Appointment" size="lg">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field} style={{ marginBottom: 14 }}>
            <label className={styles.label}>Search Existing Patient</label>
            <input
              className={styles.input}
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name / Patient ID / phone / email"
            />
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}><label className={styles.label}>Patient *</label>
              <select className={styles.input} value={form.patientId} onChange={(e) => set('patientId', e.target.value)} required>
                <option value="">Select Patient</option>
                {filteredPatients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Doctor *</label>
              <select className={styles.input} value={form.doctorId} onChange={(e) => set('doctorId', e.target.value)} required>
                <option value="">Select Doctor</option>
                {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialization}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Date *</label>
              <input type="date" className={styles.input} value={form.appointmentDate} onChange={(e) => set('appointmentDate', e.target.value)} required min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className={styles.field}><label className={styles.label}>Time *</label>
              {slots.length > 0 ? (
                <select className={styles.input} value={form.appointmentTime} onChange={(e) => set('appointmentTime', e.target.value)} required>
                  <option value="">Select Time Slot</option>
                  {slots.map(s => <option key={s.time} value={s.time} disabled={!s.available}>{s.time}{!s.available ? ' (Booked)' : ''}</option>)}
                </select>
              ) : (
                <input type="time" className={styles.input} value={form.appointmentTime} onChange={(e) => set('appointmentTime', e.target.value)} required />
              )}
            </div>
            <div className={styles.field}><label className={styles.label}>Type</label>
              <select className={styles.input} value={form.type} onChange={(e) => set('type', e.target.value)}>
                {['consultation','follow_up','emergency','routine_checkup','lab_test'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Fee ($)</label>
              <input type="number" step="0.01" className={styles.input} value={form.fee} onChange={(e) => set('fee', e.target.value)} />
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Reason for Visit</label><textarea className={styles.input} rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Notes</label><textarea className={styles.input} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>

          {selectedPatient && (
            <div style={{ marginTop: 14, border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#334155' }}>Patient Details (Auto-filled)</div>
              <div className={styles.infoGrid}>
                {[
                  ['Name', selectedPatient.name],
                  ['Patient ID', selectedPatient.patientId],
                  ['Phone', selectedPatient.phone],
                  ['Email', selectedPatient.email],
                  ['Gender', selectedPatient.gender],
                  ['DOB', selectedPatient.dateOfBirth],
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
                  {selectedPatient.allergies && <div><strong>Allergies:</strong> {selectedPatient.allergies}</div>}
                  {selectedPatient.medicalHistory && <div><strong>Medical History:</strong> {selectedPatient.medicalHistory}</div>}
                </div>
              )}
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Schedule</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="Appointment Details">
        {detailModal && (
          <div>
            <div className={styles.infoGrid}>
              {[['Appointment #', detailModal.appointmentNumber], ['Date', detailModal.appointmentDate], ['Time', detailModal.appointmentTime?.slice(0,5)],
                ['Patient', detailModal.patient?.name], ['Patient ID', detailModal.patient?.patientId], ['Doctor', `Dr. ${detailModal.doctor?.name}`],
                ['Specialization', detailModal.doctor?.specialization], ['Type', detailModal.type], ['Fee', detailModal.fee ? `$${detailModal.fee}` : '—'],
                ['Treatment Bill', detailModal.treatmentBill ? `$${detailModal.treatmentBill}` : '—']].map(([label, value]) => (
                <div key={label} className={styles.infoItem}><div className={styles.infoLabel}>{label}</div><div className={styles.infoValue}>{value || '—'}</div></div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div className={styles.infoLabel}>Status</div>
              <div style={{ marginTop: 6 }}><Badge text={detailModal.status} type={detailModal.status} /></div>
            </div>
            {detailModal.reason && <div style={{ marginTop: 16 }}><div className={styles.infoLabel}>Reason</div><div className={styles.infoValue} style={{ marginTop: 4 }}>{detailModal.reason}</div></div>}
            {detailModal.treatmentDone && <div style={{ marginTop: 16 }}><div className={styles.infoLabel}>Treatment Done</div><div style={{ background: '#fff7ed', padding: '10px 14px', borderRadius: 8, marginTop: 6 }}>{detailModal.treatmentDone}</div></div>}
            {detailModal.diagnosis && <div style={{ marginTop: 16 }}><div className={styles.infoLabel}>Diagnosis</div><div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, marginTop: 6 }}>{detailModal.diagnosis}</div></div>}
            {detailModal.prescription && <div style={{ marginTop: 16 }}><div className={styles.infoLabel}>Prescription</div><div style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: 8, marginTop: 6 }}>{detailModal.prescription}</div></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
