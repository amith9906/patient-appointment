import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Table from '../components/Table';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import styles from './Page.module.css';

const STORAGE_KEY = 'medischedule_vendors';
const INIT = { name: '', contactPerson: '', phone: '', email: '', address: '', city: '', gstin: '', pan: '', category: 'medicine', paymentTerms: 'Net 30', isActive: true, notes: '' };
const CATEGORIES = ['medicine', 'lab_supply', 'equipment', 'surgical', 'general'];

export default function Vendors() {
  const [vendors, setVendors] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [search, setSearch] = useState('');

  const save = (data) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); setVendors(data); };

  const openCreate = () => { setEditing(null); setForm(INIT); setModal(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setModal(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      const updated = vendors.map(v => v.id === editing.id ? { ...form, id: editing.id } : v);
      save(updated); toast.success('Vendor updated');
    } else {
      save([...vendors, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
      toast.success('Vendor added');
    }
    setModal(false);
  };

  const toggleActive = (id) => {
    const updated = vendors.map(v => v.id === id ? { ...v, isActive: !v.isActive } : v);
    save(updated); toast.success('Updated');
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const filtered = vendors.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.contactPerson?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'name', label: 'Vendor Name', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.contactPerson}</div></div> },
    { key: 'category', label: 'Category', render: (v) => <Badge text={v?.replace('_',' ')} type="default" /> },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'city', label: 'City' },
    { key: 'paymentTerms', label: 'Payment Terms' },
    { key: 'isActive', label: 'Status', render: (v) => <Badge text={v ? 'Active' : 'Inactive'} type={v ? 'active' : 'inactive'} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => openEdit(r)}>Edit</button>
        <button className={r.isActive ? styles.btnDelete : styles.btnSuccess} onClick={() => toggleActive(r.id)}>
          {r.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Vendors</h2><p className={styles.pageSubtitle}>{vendors.length} vendors registered · {vendors.filter(v=>v.isActive).length} active</p></div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add Vendor</button>
      </div>
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search vendor..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className={styles.card}><Table columns={columns} data={filtered} loading={false} /></div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Vendor' : 'Add Vendor'} size="lg">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Vendor / Company Name *</label><input className={styles.input} value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Contact Person</label><input className={styles.input} value={form.contactPerson || ''} onChange={e => set('contactPerson', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Category</label>
              <select className={styles.input} value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Phone</label><input className={styles.input} value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Email</label><input type="email" className={styles.input} value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>GSTIN</label><input className={styles.input} value={form.gstin || ''} onChange={e => set('gstin', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>PAN</label><input className={styles.input} value={form.pan || ''} onChange={e => set('pan', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>City</label><input className={styles.input} value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Payment Terms</label>
              <select className={styles.input} value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}>
                {['Immediate','Net 15','Net 30','Net 45','Net 60','COD'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Address</label><input className={styles.input} value={form.address || ''} onChange={e => set('address', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Notes</label><textarea className={styles.input} rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Add Vendor'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
