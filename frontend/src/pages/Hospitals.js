import React, { useState, useEffect } from 'react';
import { hospitalAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT = { name: '', address: '', city: '', state: '', zipCode: '', phone: '', email: '', website: '', type: 'general', beds: 0, description: '' };

export default function Hospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);

  const load = () => { setLoading(true); hospitalAPI.getAll().then((r) => setHospitals(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(INIT); setModal(true); };
  const openEdit = (h) => { setEditing(h); setForm({ ...h }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await hospitalAPI.update(editing.id, form); toast.success('Hospital updated'); }
      else { await hospitalAPI.create(form); toast.success('Hospital created'); }
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this hospital?')) return;
    try { await hospitalAPI.delete(id); toast.success('Hospital deactivated'); load(); }
    catch (err) { toast.error('Error'); }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (v) => <Badge text={v} type={v} /> },
    { key: 'city', label: 'City' },
    { key: 'phone', label: 'Phone' },
    { key: 'beds', label: 'Beds' },
    { key: 'isActive', label: 'Status', render: (v) => <Badge text={v ? 'Active' : 'Inactive'} type={v ? 'active' : 'inactive'} /> },
    { key: 'id', label: 'Actions', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.btnDelete} onClick={() => handleDelete(row.id)}>Deactivate</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Hospitals</h2><p className={styles.pageSubtitle}>{hospitals.length} hospitals registered</p></div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add Hospital</button>
      </div>

      <div className={styles.card}><Table columns={columns} data={hospitals} loading={loading} /></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Hospital' : 'Add Hospital'} size="lg">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <Field label="Hospital Name *" value={form.name} onChange={(v) => set('name', v)} required />
            <Field label="Type" value={form.type} onChange={(v) => set('type', v)} type="select"
              options={['general', 'specialty', 'clinic', 'teaching', 'emergency']} />
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
            <Field label="Email" value={form.email} onChange={(v) => set('email', v)} type="email" />
            <Field label="City" value={form.city} onChange={(v) => set('city', v)} />
            <Field label="State" value={form.state} onChange={(v) => set('state', v)} />
            <Field label="ZIP Code" value={form.zipCode} onChange={(v) => set('zipCode', v)} />
            <Field label="Total Beds" value={form.beds} onChange={(v) => set('beds', v)} type="number" />
            <Field label="Website" value={form.website} onChange={(v) => set('website', v)} span={2} />
            <Field label="Address" value={form.address} onChange={(v) => set('address', v)} span={2} />
            <Field label="Description" value={form.description} onChange={(v) => set('description', v)} type="textarea" span={2} />
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

function Field({ label, value, onChange, type = 'text', required, options, span }) {
  const style = span ? { gridColumn: `span ${span}` } : {};
  return (
    <div className={styles.field} style={style}>
      <label className={styles.label}>{label}</label>
      {type === 'textarea' ? (
        <textarea className={styles.input} value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : type === 'select' ? (
        <select className={styles.input} value={value || ''} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
      ) : (
        <input className={styles.input} type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} required={required} />
      )}
    </div>
  );
}
