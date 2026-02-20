import React, { useState, useEffect } from 'react';
import { departmentAPI, hospitalAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT = { name: '', description: '', floor: '', hospitalId: '' };

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [hospitalFilter, setHospitalFilter] = useState('');

  const load = () => {
    setLoading(true);
    const params = hospitalFilter ? { hospitalId: hospitalFilter } : {};
    Promise.all([departmentAPI.getAll(params), hospitalAPI.getAll()])
      .then(([d, h]) => { setDepartments(d.data); setHospitals(h.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [hospitalFilter]);

  const openCreate = () => { setEditing(null); setForm(INIT); setModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ ...d }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await departmentAPI.update(editing.id, form); toast.success('Department updated'); }
      else { await departmentAPI.create(form); toast.success('Department created'); }
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this department?')) return;
    try { await departmentAPI.delete(id); toast.success('Department deactivated'); load(); }
    catch { toast.error('Error'); }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  const columns = [
    { key: 'name', label: 'Department Name', render: (v) => <div style={{ fontWeight: 600 }}>{v}</div> },
    { key: 'hospital', label: 'Hospital', render: (v) => v?.name || '—' },
    { key: 'floor', label: 'Floor' },
    { key: 'description', label: 'Description', render: (v) => v ? v.slice(0, 60) + (v.length > 60 ? '...' : '') : '—' },
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
        <div><h2 className={styles.pageTitle}>Departments</h2><p className={styles.pageSubtitle}>{departments.length} departments</p></div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add Department</button>
      </div>
      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)}>
          <option value="">All Hospitals</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className={styles.card}><Table columns={columns} data={departments} loading={loading} /></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Department' : 'Add Department'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div className={styles.field}><label className={styles.label}>Department Name *</label><input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Hospital *</label>
              <select className={styles.input} value={form.hospitalId || ''} onChange={(e) => set('hospitalId', e.target.value)} required>
                <option value="">Select Hospital</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Floor</label><input className={styles.input} value={form.floor || ''} onChange={(e) => set('floor', e.target.value)} placeholder="e.g. 2nd Floor, Wing B" /></div>
            <div className={styles.field}><label className={styles.label}>Description</label><textarea className={styles.input} rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
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
