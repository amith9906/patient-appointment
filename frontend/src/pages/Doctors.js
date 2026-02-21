import React, { useState, useEffect } from 'react';
import { doctorAPI, hospitalAPI, departmentAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
            <div className={styles.field}><label className={styles.label}>Hospital</label>
              <SearchableSelect
                className={styles.input}
                value={form.hospitalId || ''}
                onChange={(v) => { set('hospitalId', v); loadDepts(v); }}
                placeholder="Search hospital"
                emptyLabel="Select Hospital"
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
              />
            </div>
            <div className={styles.field}><label className={styles.label}>Department</label>
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
