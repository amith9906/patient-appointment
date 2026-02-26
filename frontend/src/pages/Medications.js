import React, { useState, useEffect, useRef, useCallback } from 'react';
import { medicationAPI, hospitalAPI, bulkAPI } from '../services/api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';
import PaginationControls from '../components/PaginationControls';

const CATEGORIES = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'patch', 'suppository', 'vaccine', 'other'];

const INIT = {
  name: '', genericName: '', composition: '', category: 'tablet', dosage: '',
  manufacturer: '', description: '', sideEffects: '', contraindications: '',
  stockQuantity: 0, unitPrice: 0, purchasePrice: '', gstRate: 0,
  hsnCode: '', barcode: '', supplierName: '',
  location: '', reorderLevel: 10,
  expiryDate: '', batchNo: '', mfgDate: '', requiresPrescription: true, hospitalId: '',
  scheduleCategory: 'otc',
  isRestrictedDrug: false,
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getMedDaysRemaining(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate + 'T00:00:00');
  return Math.floor((exp - today) / (1000 * 60 * 60 * 24));
}

function getRowBg(days) {
  if (days === null) return undefined;
  if (days < 0) return '#fef2f2';      // expired - light red
  if (days <= 90) return '#fee2e2';    // expiring within 3 months - red alert
  return undefined;
}

function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>;
  const days = getMedDaysRemaining(expiryDate);
  let color, label, bg;
  if (days < 0) { color = '#b91c1c'; bg = '#fee2e2'; label = `EXPIRED (${Math.abs(days)}d ago)`; }
  else if (days === 0) { color = '#b91c1c'; bg = '#fee2e2'; label = 'Expires TODAY'; }
  else if (days <= 90) { color = '#b91c1c'; bg = '#fee2e2'; label = `${days}d - Expiring < 3 months`; }
  else { color = '#15803d'; bg = undefined; label = expiryDate; }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{expiryDate}</div>
      {bg ? (
        <span style={{ background: bg, color, padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
          {label}
        </span>
      ) : (
        <span style={{ color, fontSize: 11 }}>{days > 90 ? `${days}d left` : label}</span>
      )}
    </div>
  );
}

function daysRemainingColor(days) {
  if (days === null) return '#64748b';
  if (days < 0) return '#dc2626';
  if (days <= 90) return '#dc2626';
  return '#16a34a';
}

function daysRemainingLabel(days) {
  if (days === null) return '-';
  if (days < 0) return `EXPIRED (${Math.abs(days)}d ago)`;
  if (days === 0) return 'Expires TODAY';
  return `${days}d remaining`;
}

export default function Medications() {
  const [tab, setTab] = useState('list');
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
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] = useState(null);
  const [catFilter, setCatFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');  // 'low' | 'expired' | 'expiring'

  // Expiry alert state
  const [expiryData, setExpiryData] = useState([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [expiryDays, setExpiryDays] = useState(30);
  const [expiryCat, setExpiryCat] = useState('');
  const [expiryHospital, setExpiryHospital] = useState('');

  // Bulk upload state
  const [bulkHospitalId, setBulkHospitalId] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      page,
      per_page: perPage,
    };
    if (stockFilter === 'vaccines') {
      params.category = 'vaccine';
    } else if (catFilter) {
      params.category = catFilter;
    }
    if (stockFilter === 'low') {
      params.lowStock = 'true';
    } else if (stockFilter === 'expired') {
      params.stockStatus = 'expired';
    } else if (stockFilter === 'expiring') {
      params.stockStatus = 'expiring';
    }
    if (search.trim()) {
      params.search = search.trim();
    }

    medicationAPI.getAll(params)
      .then((m) => {
        setMeds(m.data || []);
        setPagination(m.pagination || null);
      })
      .catch(() => setMeds([]))
      .finally(() => setLoading(false));
  }, [catFilter, page, perPage, search, stockFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    hospitalAPI.getAll()
      .then((res) => setHospitals(res.data || []))
      .catch(() => setHospitals([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [catFilter, stockFilter, search]);

  const loadExpiry = () => {
    setExpiryLoading(true);
    const params = { days: expiryDays };
    if (expiryCat) params.category = expiryCat;
    if (expiryHospital) params.hospitalId = expiryHospital;
    medicationAPI.getExpiryAlerts(params)
      .then((r) => setExpiryData(r.data || []))
      .catch(() => setExpiryData([]))
      .finally(() => setExpiryLoading(false));
  };

  useEffect(() => {
    if (tab === 'expiry') loadExpiry();
  }, [tab]);

  const openCreate = () => { setEditing(null); setForm(INIT); setModal(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({
      ...m,
      gstRate: Number(m.gstRate || 0),
      purchasePrice: m.purchasePrice || '',
      hsnCode: m.hsnCode || '',
      barcode: m.barcode || '',
      supplierName: m.supplierName || '',
      batchNo: '',
      mfgDate: '',
    });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (editing) {
        delete payload.batchNo;
        delete payload.mfgDate;
        await medicationAPI.update(editing.id, payload);
        toast.success('Medication updated');
      } else {
        await medicationAPI.create(payload);
        toast.success('Medication created');
      }
      setModal(false); load();
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const handleStock = async (e) => {
    e.preventDefault();
    try {
      await medicationAPI.updateStock(stockModal.id, stockForm);
      toast.success('Stock updated');
      setStockModal(null); load();
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
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
      toast.error(err.response.data.message || 'Upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  // Auto-check restricted flag when scheduleCategory indicates Schedule H
  useEffect(() => {
    try {
      const sc = String(form.scheduleCategory || '').trim().toLowerCase();
      if (sc && sc.startsWith('schedule_h')) {
        if (!form.isRestrictedDrug) set('isRestrictedDrug', true);
      }
    } catch (e) {
      // ignore
    }
  }, [form.scheduleCategory]);

  // Computed stats for summary cards
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = {
    total: meds.length,
    totalStock: meds.reduce((s, m) => s + Number(m.stockQuantity || 0), 0),
    vaccines: meds.filter(m => m.category === 'vaccine'),
    tablets: meds.filter(m => m.category === 'tablet'),
    lowStock: meds.filter(m => Number(m.stockQuantity || 0) < Number(m.reorderLevel || 10)),
    expired: meds.filter(m => {
      if (!m.expiryDate) return false;
      return new Date(m.expiryDate + 'T00:00:00') < today;
    }),
    expiringSoon: meds.filter(m => {
      if (!m.expiryDate) return false;
      const exp = new Date(m.expiryDate + 'T00:00:00');
      const diff = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 90;
    }),
  };

  // Expiry summary counts
  const expiryExpired = expiryData.filter(m => (m.daysRemaining || 0) < 0).length;
  const expiryCritical = expiryData.filter(m => m.daysRemaining >= 0 && m.daysRemaining < 7).length;
  const expiryWarning = expiryData.filter(m => m.daysRemaining >= 0 && m.daysRemaining <= 90).length;
  const expirySafe = expiryData.filter(m => m.daysRemaining > 90).length;

  const expiryColumns = [
    { key: 'name', label: 'Medicine', render: (v, r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{v}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{r.genericName}</div>
      </div>
    )},
    { key: 'category', label: 'Category', render: (v) => <Badge text={v} type={v} /> },
    { key: 'expiryDate', label: 'Expiry Date', render: (v) => v || '-' },
    { key: 'daysRemaining', label: 'Status', render: (v) => (
      <span style={{ fontWeight: 700, color: daysRemainingColor(v) }}>
        {daysRemainingLabel(v)}
      </span>
    )},
    { key: 'stockQuantity', label: 'Stock', render: (v, r) => <span style={{ fontWeight: 700, color:Number(v || 0) < Number(r.reorderLevel || 10) ? '#dc2626' : '#334155'}}>{v}</span> },
    { key: 'hospital', label: 'Hospital', render: (v) => v?.name || '-' },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Medications & Inventory</h2>
          <p className={styles.pageSubtitle}>
            Showing {meds.length} of {pagination?.total ?? meds.length} items  |  {stats.totalStock.toLocaleString()} total units
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => { setBulkFile(null); setBulkResult(null); setBulkHospitalId(''); setBulkModal(true); }}>Bulk Upload</button>
          <button className={styles.btnPrimary} onClick={openCreate}>+ Add Medication</button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div className={styles.card} style={{ padding: '12px 16px', borderLeft: '4px solid #2563eb', cursor: 'pointer' }}
          onClick={() => { setStockFilter(''); setCatFilter(''); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Total Medicines</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{stats.totalStock.toLocaleString()} units in stock</div>
        </div>
        <div className={styles.card} style={{ padding: '12px 16px', borderLeft: '4px solid #7c3aed', cursor: 'pointer' }}
          onClick={() => { setStockFilter('vaccines'); setCatFilter(''); setTab('list'); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{stats.vaccines.length}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Vaccines</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{stats.vaccines.reduce((s, m) => s + Number(m.stockQuantity || 0), 0)} units</div>
        </div>
        <div className={styles.card} style={{ padding: '12px 16px', borderLeft: '4px solid #0891b2', cursor: 'pointer' }}
          onClick={() => { setStockFilter(''); setCatFilter('tablet'); setTab('list'); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{stats.tablets.length}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Tablets</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{stats.tablets.reduce((s, m) => s + Number(m.stockQuantity || 0), 0)} units</div>
        </div>
        <div className={styles.card} style={{ padding: '12px 16px', borderLeft: '4px solid #d97706', cursor: 'pointer' }}
          onClick={() => { setStockFilter('low'); setCatFilter(''); setTab('list'); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color:stats.lowStock.length > 0 ? '#d97706' : '#1e293b'}}>
            {stats.lowStock.length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Low Stock</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Below configured reorder level</div>
        </div>
        <div className={styles.card} style={{ padding: '12px 16px', borderLeft: '4px solid #dc2626', cursor: 'pointer' }}
          onClick={() => { setStockFilter('expired'); setCatFilter(''); setTab('list'); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color:stats.expired.length > 0 ? '#dc2626' : '#1e293b'}}>
            {stats.expired.length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Expired</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Past expiry date</div>
        </div>
        <div className={styles.card} style={{ padding: '12px 16px', borderLeft: '4px solid #f97316', cursor: 'pointer' }}
          onClick={() => { setStockFilter('expiring'); setCatFilter(''); setTab('list'); }}>
          <div style={{ fontSize: 22, fontWeight: 700, color:stats.expiringSoon.length > 0 ? '#f97316' : '#1e293b'}}>
            {stats.expiringSoon.length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Expiring Soon</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Within 90 days</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={tab === 'list' ? styles.btnPrimary : styles.btnSecondary} onClick={() => setTab('list')}>
          Inventory
        </button>
        <button className={tab === 'expiry' ? styles.btnPrimary : styles.btnSecondary} onClick={() => setTab('expiry')}>
          Warning Expiry Alerts
          {expiryData.length > 0 && tab !== 'expiry' && (
            <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 6px' }}>
              {expiryData.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className={styles.filterBar}>
            <input className={styles.searchInput} placeholder="Search medication..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={styles.filterSelect} value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setStockFilter(''); }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select className={styles.filterSelect} value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setCatFilter(''); }}>
              <option value="">All Stock Status</option>
              <option value="low">Warning Low Stock (&lt; Reorder)</option>
              <option value="expired">Expired</option>
              <option value="expiring">Expiring within 90 days</option>
              <option value="vaccines">Vaccine Vaccines only</option>
            </select>
            {(stockFilter || catFilter || search) && (
              <button className={styles.btnSecondary} onClick={() => { setSearch(''); setCatFilter(''); setStockFilter(''); }}>
                Clear Filters
              </button>
            )}
          </div>

          {/* Legend for row colors */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
            <span>Row color:</span>
            <span style={{ background: '#fef2f2', padding: '1px 8px', borderRadius: 4, color: '#b91c1c', fontWeight: 600 }}>Expired</span>
            <span style={{ background: '#fee2e2', padding: '1px 8px', borderRadius: 4, color: '#b91c1c', fontWeight: 600 }}>Expiring within 90 days</span>
          </div>

          <div className={styles.card} style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
            ) : meds.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No medicines found</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['Medicine', 'HSN', 'Type', 'Dosage', 'Location', 'Stock', 'Price', 'GST', 'Expiry', 'Rx', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map((m) => {
                      const days = getMedDaysRemaining(m.expiryDate);
                      const rowBg = getRowBg(days);
                      return (
                        <tr key={m.id} style={{ background: rowBg, borderBottom: '1px solid #f1f5f9', transition: 'opacity 0.1s' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{m.name}</div>
                            {m.genericName && <div style={{ fontSize: 11, color: '#64748b' }}>{m.genericName}</div>}
                            {m.composition && <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 1 }}>{m.composition}</div>}
                            {m.barcode && <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>|||  {m.barcode}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            {m.hsnCode ? (
                              <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                {m.hsnCode}
                              </span>
                            ) : <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <Badge text={m.category} type={m.category} />
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{m.dosage || '-'}</td>
                          <td style={{ padding: '10px 12px', color: '#475569', minWidth: 120 }}>{m.location || '-'}</td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontWeight: 700,
                              color: Number(m.stockQuantity || 0) < Number(m.reorderLevel || 10) ? '#dc2626' : '#16a34a',
                            }}>
                              {m.stockQuantity}
                            </span>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>Reorder {Number(m.reorderLevel || 10)}</div>
                            {Number(m.stockQuantity || 0) < Number(m.reorderLevel || 10) && (
                              <span style={{ marginLeft: 4, fontSize: 10, color: '#dc2626', fontWeight: 600 }}>LOW</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            Rs {parseFloat(m.unitPrice || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              background: Number(m.gstRate || 0) === 0 ? '#f1f5f9' : '#dcfce7',
                              color: Number(m.gstRate || 0) === 0 ? '#64748b' : '#15803d',
                              padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            }}>
                              {Number(m.gstRate || 0) === 0 ? 'Exempt' : `${Number(m.gstRate)}%`}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', minWidth: 120 }}>
                            <ExpiryBadge expiryDate={m.expiryDate} />
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <Badge text={m.requiresPrescription ? 'Required' : 'OTC'} type={m.requiresPrescription ? 'scheduled' : 'active'} />
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <div className={styles.actions}>
                              <button className={styles.btnEdit} onClick={() => openEdit(m)}>Edit</button>
                              <button className={styles.btnSuccess} onClick={() => { setStockModal(m); setStockForm({ quantity: 0, operation: 'add' }); }}>Stock</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {pagination && (
            <PaginationControls
              meta={pagination}
              onPageChange={(next) => setPage(next)}
              onPerPageChange={(value) => { setPerPage(value); setPage(1); }}
            />
          )}
          <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
            Showing {meds.length} of {pagination?.total ?? meds.length} medicines
          </div>
        </>
      )}

      {tab === 'expiry' && (
        <div>
          <div className={`${styles.card} ${styles.filterBar}`} style={{ padding: '12px 16px', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <label style={{ color: '#64748b', fontWeight: 500 }}>Expiring within:</label>
              <select className={styles.filterSelect} value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
                <option value={7}>7 days</option>
                <option value={15}>15 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <select className={styles.filterSelect} value={expiryCat} onChange={(e) => setExpiryCat(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <SearchableSelect
              className={styles.filterSelect}
              value={expiryHospital}
              onChange={setExpiryHospital}
              options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
              placeholder="Search hospital..."
              emptyLabel="All Hospitals"
            />
            <button className={styles.btnPrimary} onClick={loadExpiry}>Apply</button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Expired', count: expiryExpired, bg: '#fee2e2', color: '#b91c1c' },
              { label: 'Critical (<7d)', count: expiryCritical, bg: '#fef3c7', color: '#92400e' },
              { label: 'Warning (<=90d)', count: expiryWarning, bg: '#fee2e2', color: '#b91c1c' },
              { label: 'Safe (>90d)', count: expirySafe, bg: '#dcfce7', color: '#15803d' },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, color: s.color, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                {s.count} {s.label}
              </div>
            ))}
          </div>

          {expiryLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
          ) : expiryData.length === 0 ? (
            <div className={styles.card} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              No medicines found expiring within selected period
            </div>
          ) : (
            <div className={styles.card} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['Medicine', 'Category', 'Expiry Date', 'Status', 'Stock', 'Hospital'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expiryData.map((m) => {
                      const rowBg = getRowBg(m.daysRemaining);
                      return (
                        <tr key={m.id} style={{ background: rowBg, borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{m.genericName}</div>
                          </td>
                          <td style={{ padding: '10px 12px' }}><Badge text={m.category} type={m.category} /></td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#475569' }}>{m.expiryDate || '-'}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: daysRemainingColor(m.daysRemaining) }}>
                            {daysRemainingLabel(m.daysRemaining)}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color:Number(m.stockQuantity || 0) < Number(m.reorderLevel || 10) ? '#dc2626' : '#334155'}}>
                            {m.stockQuantity}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{m.hospital?.name || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
            <div className={styles.field}><label className={styles.label}>Unit Price / MRP (Rs )</label><input type="number" step="0.01" className={styles.input} value={form.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Purchase Price / Cost (Rs )</label><input type="number" step="0.01" placeholder="Cost price from supplier" className={styles.input} value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>GST Rate</label>
              <select className={styles.input} value={Number(form.gstRate || 0)} onChange={(e) => set('gstRate', Number(e.target.value))}>
                <option value={0}>0% - Exempt (no GST)</option>
                <option value={5}>5% - Essential medicines</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Schedule Category</label>
              <select className={styles.input} value={form.scheduleCategory || 'otc'} onChange={(e) => set('scheduleCategory', e.target.value)}>
                <option value="otc">OTC</option>
                <option value="schedule_h">Schedule H</option>
                <option value="schedule_h1">Schedule H1</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Is Restricted Drug</label>
              <input type="checkbox" style={{ transform: 'scale(1.2)' }} checked={Boolean(form.isRestrictedDrug)} onChange={(e) => set('isRestrictedDrug', e.target.checked)} />
            </div>
            <div className={styles.field}><label className={styles.label}>HSN Code</label><input className={styles.input} placeholder="e.g. 3004 (medicines), 3002 (vaccines)" value={form.hsnCode || ''} onChange={(e) => set('hsnCode', e.target.value)} maxLength={10} /></div>
            <div className={styles.field}><label className={styles.label}>Barcode (EAN/UPC)</label><input className={styles.input} placeholder="Scan or enter barcode" value={form.barcode || ''} onChange={(e) => set('barcode', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Supplier / Vendor</label><input className={styles.input} placeholder="Default supplier name" value={form.supplierName || ''} onChange={(e) => set('supplierName', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Rack / Shelf Location</label><input className={styles.input} placeholder="e.g. Shelf A, Box 4" value={form.location || ''} onChange={(e) => set('location', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Reorder Level</label><input type="number" min={0} className={styles.input} value={form.reorderLevel ?? 10} onChange={(e) => set('reorderLevel', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Stock Quantity</label><input type="number" className={styles.input} value={form.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Opening Batch No (create only)</label><input className={styles.input} placeholder="e.g. OPEN-A1" value={form.batchNo || ''} onChange={(e) => set('batchNo', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Opening Mfg Date (create only)</label><input type="date" className={styles.input} value={form.mfgDate || ''} onChange={(e) => set('mfgDate', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Expiry Date</label><input type="date" className={styles.input} value={form.expiryDate || ''} onChange={(e) => set('expiryDate', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Hospital</label>
              <SearchableSelect
                className={styles.input}
                value={form.hospitalId || ''}
                onChange={(value) => set('hospitalId', value)}
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                placeholder="Search hospital..."
                emptyLabel="Select Hospital"
              />
            </div>
            <div className={styles.field}><label className={styles.label}>Prescription Required</label>
              <select className={styles.input} value={form.requiresPrescription ? 'true' : 'false'} onChange={(e) => set('requiresPrescription', e.target.value === 'true')}>
                <option value="true">Yes (Prescription Required)</option>
                <option value="false">No (OTC)</option>
              </select>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Description</label><textarea className={styles.input} rows={2} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Side Effects</label><textarea className={styles.input} rows={2} value={form.sideEffects || ''} onChange={(e) => set('sideEffects', e.target.value)} /></div>
            {!editing && (
              <div className={styles.field} style={{ gridColumn: 'span 2', fontSize: 12, color: '#64748b' }}>
                If stock quantity is greater than 0, opening batch and stock ledger entries are created automatically.
              </div>
            )}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Stock Modal */}
      <Modal isOpen={!!stockModal} onClose={() => setStockModal(null)} title={`Update Stock - ${stockModal?.name || ''}`} size="sm">
        {stockModal && (
          <form onSubmit={handleStock} className={styles.form}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
                Current Stock: <strong>{Number(stockModal.stockQuantity || 0)}</strong> units
                {stockModal.expiryDate && (
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    Expires: <strong>{stockModal.expiryDate}</strong>
                    {getMedDaysRemaining(stockModal.expiryDate) <= 90 && (
                      <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 600 }}>
                        Warning {getMedDaysRemaining(stockModal.expiryDate) < 0 ? 'EXPIRED' : `${getMedDaysRemaining(stockModal.expiryDate)}d remaining`}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className={styles.field}><label className={styles.label}>Operation</label>
                <select className={styles.input} value={stockForm.operation} onChange={(e) => setStockForm({ ...stockForm, operation: e.target.value })}>
                  <option value="add">Add Stock</option>
                  <option value="subtract">Remove Stock</option>
                </select>
              </div>
              <div className={styles.field}><label className={styles.label}>Quantity</label>
                <input type="number" className={styles.input} min={1} value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) })} required />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setStockModal(null)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary}>Update Stock</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal isOpen={bulkModal} onClose={() => { setBulkModal(false); setBulkResult(null); }} title="Bulk Upload Medications" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Step 1 - Download Template</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
              Download the Excel template, fill in your medications data, and then upload it below.
            </div>
            <button onClick={handleDownloadTemplate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Download Template (.xlsx)
            </button>
          </div>

          <form onSubmit={handleBulkUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 600, color: '#1e40af' }}>Step 2 - Upload Filled Template</div>
            <div className={styles.field}>
              <label className={styles.label}>Hospital (optional)</label>
              <SearchableSelect
                className={styles.input}
                value={bulkHospitalId}
                onChange={setBulkHospitalId}
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                placeholder="Search hospital..."
                emptyLabel="- All / No specific hospital -"
              />
            </div>
            <div onClick={() => fileInputRef.current.click()} style={{ border: '2px dashed #93c5fd', borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background:bulkFile ? '#f0fdf4' : '#f8fafc'}}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { setBulkFile(e.target.files[0] || null); setBulkResult(null); }} />
              {bulkFile ? (
                <div><div style={{ fontSize: 28 }}>File Ready</div><div style={{ fontWeight: 600, color: '#15803d' }}>{bulkFile.name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{(bulkFile.size / 1024).toFixed(1)} KB</div></div>
              ) : (
                <div><div style={{ fontSize: 28 }}>Select File</div><div style={{ fontWeight: 600 }}>Click to select Excel file</div><div style={{ fontSize: 12, color: '#64748b' }}>.xlsx or .xls</div></div>
              )}
            </div>
            {bulkResult && (
              <div style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background:bulkResult.errors.length === 0 ? '#dcfce7' : '#fef3c7', padding: '12px 16px', fontWeight: 600, color:bulkResult.errors.length === 0 ? '#15803d' : '#92400e'}}>
                  {bulkResult.message}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div style={{ background: '#fff7ed', padding: '10px 16px', maxHeight: 160, overflowY: 'auto' }}>
                    {bulkResult.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#b45309' }}>Row {e.row}: {e.error}</div>)}
                  </div>
                )}
              </div>
            )}
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => { setBulkModal(false); setBulkResult(null); }}>Close</button>
              <button type="submit" className={styles.btnPrimary} disabled={!bulkFile || bulkUploading}>{bulkUploading ? 'Uploading...' : 'Upload & Import'}</button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
