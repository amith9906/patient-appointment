import React, { useState, useEffect, useRef } from 'react';
import { medicationAPI, hospitalAPI, bulkAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const CATEGORIES = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'other'];
const INIT = { name: '', genericName: '', composition: '', category: 'tablet', dosage: '', manufacturer: '', description: '', sideEffects: '', contraindications: '', stockQuantity: 0, unitPrice: 0, expiryDate: '', requiresPrescription: true, hospitalId: '' };

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Medications() {
  const [meds, setMeds] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [stockModal, setStockModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [stockForm, setStockForm] = useState({ quantity: 0, operation: 'add' });
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Bulk upload state
  const [bulkHospitalId, setBulkHospitalId] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    const params = {};
    if (catFilter) params.category = catFilter;
    Promise.all([medicationAPI.getAll(params), hospitalAPI.getAll()])
      .then(([m, h]) => { setMeds(m.data); setHospitals(h.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [catFilter]);

  const openCreate = () => { setEditing(null); setForm(INIT); setModal(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...m }); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await medicationAPI.update(editing.id, form); toast.success('Medication updated'); }
      else { await medicationAPI.create(form); toast.success('Medication created'); }
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleStock = async (e) => {
    e.preventDefault();
    try {
      await medicationAPI.updateStock(stockModal.id, stockForm);
      toast.success('Stock updated');
      setStockModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await bulkAPI.downloadMedicationTemplate();
      downloadBlob(res.data, 'medications_template.xlsx');
    } catch { toast.error('Failed to download template'); }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) return toast.error('Please select a file');
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      if (bulkHospitalId) fd.append('hospitalId', bulkHospitalId);
      const res = await bulkAPI.uploadMedications(fd);
      setBulkResult(res.data);
      if (res.data.created > 0) load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const openBulkModal = () => {
    setBulkFile(null); setBulkResult(null); setBulkHospitalId('');
    setBulkModal(true);
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const filtered = meds.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.genericName?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: 'name', label: 'Name', render: (v, r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{v}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{r.genericName}</div>
        {r.composition && <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>{r.composition}</div>}
      </div>
    )},
    { key: 'category', label: 'Type', render: (v) => <Badge text={v} type={v} /> },
    { key: 'dosage', label: 'Dosage' },
    { key: 'stockQuantity', label: 'Stock', render: (v) => <span style={{ fontWeight: 700, color: v < 10 ? '#dc2626' : v < 50 ? '#d97706' : '#16a34a' }}>{v}</span> },
    { key: 'unitPrice', label: 'Price', render: (v) => `₹${parseFloat(v || 0).toFixed(2)}` },
    { key: 'expiryDate', label: 'Expiry' },
    { key: 'requiresPrescription', label: 'Rx', render: (v) => <Badge text={v ? 'Required' : 'OTC'} type={v ? 'scheduled' : 'active'} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => openEdit(r)}>Edit</button>
        <button className={styles.btnSuccess} onClick={() => { setStockModal(r); setStockForm({ quantity: 0, operation: 'add' }); }}>Stock</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Medications & Tablets</h2><p className={styles.pageSubtitle}>{meds.length} items in inventory</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={openBulkModal}>⬆ Bulk Upload</button>
          <button className={styles.btnPrimary} onClick={openCreate}>+ Add Medication</button>
        </div>
      </div>
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search medication..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>
      <div className={styles.card}><Table columns={columns} data={filtered} loading={loading} /></div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Medication' : 'Add Medication'} size="lg">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}><label className={styles.label}>Medication Name *</label><input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Generic Name</label><input className={styles.input} value={form.genericName || ''} onChange={(e) => set('genericName', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Composition</label><input className={styles.input} placeholder="e.g. Paracetamol 500mg + Caffeine 65mg" value={form.composition || ''} onChange={(e) => set('composition', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Category</label>
              <select className={styles.input} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Dosage (e.g. 500mg)</label><input className={styles.input} value={form.dosage || ''} onChange={(e) => set('dosage', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Manufacturer</label><input className={styles.input} value={form.manufacturer || ''} onChange={(e) => set('manufacturer', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Unit Price (₹)</label><input type="number" step="0.01" className={styles.input} value={form.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Stock Quantity</label><input type="number" className={styles.input} value={form.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Expiry Date</label><input type="date" className={styles.input} value={form.expiryDate || ''} onChange={(e) => set('expiryDate', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Hospital</label>
              <select className={styles.input} value={form.hospitalId || ''} onChange={(e) => set('hospitalId', e.target.value)}>
                <option value="">Select Hospital</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Prescription Required</label>
              <select className={styles.input} value={form.requiresPrescription ? 'true' : 'false'} onChange={(e) => set('requiresPrescription', e.target.value === 'true')}>
                <option value="true">Yes (Prescription Required)</option>
                <option value="false">No (OTC)</option>
              </select>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Description</label><textarea className={styles.input} rows={2} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Side Effects</label><textarea className={styles.input} rows={2} value={form.sideEffects || ''} onChange={(e) => set('sideEffects', e.target.value)} /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Stock Modal */}
      <Modal isOpen={!!stockModal} onClose={() => setStockModal(null)} title={`Update Stock — ${stockModal?.name}`} size="sm">
        <form onSubmit={handleStock} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
              Current Stock: <strong>{stockModal?.stockQuantity}</strong> units
            </div>
            <div className={styles.field}><label className={styles.label}>Operation</label>
              <select className={styles.input} value={stockForm.operation} onChange={(e) => setStockForm({ ...stockForm, operation: e.target.value })}>
                <option value="add">Add Stock</option><option value="subtract">Remove Stock</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Quantity</label><input type="number" className={styles.input} min={1} value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) })} required /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setStockModal(null)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Update Stock</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal isOpen={bulkModal} onClose={() => { setBulkModal(false); setBulkResult(null); }} title="Bulk Upload Medications" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Step 1: Download template */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Step 1 — Download Template</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
              Download the Excel template, fill in your medications data, and then upload it below.
              The template includes sample rows and an Instructions sheet explaining each column.
            </div>
            <button
              onClick={handleDownloadTemplate}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              ⬇ Download Template (.xlsx)
            </button>
          </div>

          {/* Step 2: Upload */}
          <form onSubmit={handleBulkUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 600, color: '#1e40af' }}>Step 2 — Upload Filled Template</div>

            <div className={styles.field}>
              <label className={styles.label}>Hospital (optional)</label>
              <select className={styles.input} value={bulkHospitalId} onChange={(e) => setBulkHospitalId(e.target.value)}>
                <option value="">— All / No specific hospital —</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #93c5fd', borderRadius: 10, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', background: bulkFile ? '#f0fdf4' : '#f8fafc',
                transition: 'background 0.2s',
              }}
            >
              <input
                ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={(e) => { setBulkFile(e.target.files[0] || null); setBulkResult(null); }}
              />
              {bulkFile ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📊</div>
                  <div style={{ fontWeight: 600, color: '#15803d' }}>{bulkFile.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {(bulkFile.size / 1024).toFixed(1)} KB — Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                  <div style={{ fontWeight: 600, color: '#374151' }}>Click to select Excel file</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>.xlsx or .xls — max 5 MB</div>
                </div>
              )}
            </div>

            {/* Result summary */}
            {bulkResult && (
              <div style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  background: bulkResult.errors.length === 0 ? '#dcfce7' : '#fef3c7',
                  padding: '12px 16px', fontWeight: 600,
                  color: bulkResult.errors.length === 0 ? '#15803d' : '#92400e',
                }}>
                  {bulkResult.message}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div style={{ background: '#fff7ed', padding: '10px 16px', maxHeight: 160, overflowY: 'auto' }}>
                    {bulkResult.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#b45309', padding: '2px 0' }}>
                        Row {e.row}: {e.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => { setBulkModal(false); setBulkResult(null); }}>Close</button>
              <button type="submit" className={styles.btnPrimary} disabled={!bulkFile || bulkUploading}>
                {bulkUploading ? 'Uploading...' : '⬆ Upload & Import'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
