import React, { useState, useEffect } from 'react';
import { medicationAPI } from '../services/api';
import { toast } from 'react-toastify';
import Table from '../components/Table';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import styles from './Page.module.css';

const PURCHASE_KEY = 'medischedule_purchases';

export default function StockManagement() {
  const [medications, setMedications] = useState([]);
  const [purchases, setPurchases] = useState(() => JSON.parse(localStorage.getItem(PURCHASE_KEY) || '[]'));
  const [vendors, setVendors] = useState(() => JSON.parse(localStorage.getItem('medischedule_vendors') || '[]'));
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stock');
  const [stockModal, setStockModal] = useState(null);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ medicationId: '', vendorId: '', quantity: 1, unitCost: 0, invoiceNumber: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' });

  const load = () => {
    setLoading(true);
    medicationAPI.getAll().then(r => setMedications(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    try {
      await medicationAPI.updateStock(stockModal.id, { quantity: parseInt(stockModal.qty), operation: stockModal.op });
      toast.success('Stock updated');
      setStockModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    const med = medications.find(m => m.id === purchaseForm.medicationId);
    const vendor = vendors.find(v => v.id === purchaseForm.vendorId);
    const newPurchase = {
      id: Date.now().toString(), ...purchaseForm,
      medicationName: med?.name, vendorName: vendor?.name,
      totalCost: (purchaseForm.quantity * purchaseForm.unitCost).toFixed(2),
      createdAt: new Date().toISOString(),
    };
    const updated = [newPurchase, ...purchases];
    localStorage.setItem(PURCHASE_KEY, JSON.stringify(updated));
    setPurchases(updated);
    // Also update stock in DB
    try {
      await medicationAPI.updateStock(purchaseForm.medicationId, { quantity: parseInt(purchaseForm.quantity), operation: 'add' });
      toast.success('Purchase recorded and stock updated!');
    } catch { toast.success('Purchase recorded (stock update failed)'); }
    setPurchaseModal(false);
    setPurchaseForm({ medicationId: '', vendorId: '', quantity: 1, unitCost: 0, invoiceNumber: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' });
    load();
  };

  const lowStock = medications.filter(m => m.stockQuantity < 10);
  const totalValue = medications.reduce((s, m) => s + (m.stockQuantity * parseFloat(m.unitPrice || 0)), 0);

  const stockCols = [
    { key: 'name', label: 'Medication', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.category} · {r.dosage}</div></div> },
    { key: 'stockQuantity', label: 'Stock', render: (v) => <span style={{ fontWeight: 700, fontSize: 15, color: v < 10 ? '#dc2626' : v < 50 ? '#d97706' : '#16a34a' }}>{v} {v < 10 ? '⚠️' : ''}</span> },
    { key: 'unitPrice', label: 'Unit Price', render: (v) => `₹${parseFloat(v||0).toFixed(2)}` },
    { key: 'stockQuantity', label: 'Stock Value', render: (v, r) => `₹${(v * parseFloat(r.unitPrice||0)).toFixed(2)}` },
    { key: 'expiryDate', label: 'Expiry' },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnSuccess} onClick={() => setStockModal({ ...r, qty: 1, op: 'add' })}>Add Stock</button>
        <button className={styles.btnWarning} onClick={() => setStockModal({ ...r, qty: 1, op: 'subtract' })}>Remove</button>
      </div>
    )},
  ];

  const purchaseCols = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</span> },
    { key: 'purchaseDate', label: 'Date' },
    { key: 'medicationName', label: 'Medication' },
    { key: 'vendorName', label: 'Vendor' },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitCost', label: 'Unit Cost', render: (v) => `₹${parseFloat(v||0).toFixed(2)}` },
    { key: 'totalCost', label: 'Total', render: (v) => <strong>₹{parseFloat(v||0).toFixed(2)}</strong> },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Stock Management</h2><p className={styles.pageSubtitle}>Medical inventory and purchase tracking</p></div>
        <button className={styles.btnPrimary} onClick={() => setPurchaseModal(true)}>+ Record Purchase</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Items', value: medications.length, color: '#2563eb', icon: '💊' },
          { label: 'Low Stock Items', value: lowStock.length, color: '#dc2626', icon: '⚠️' },
          { label: 'Total Stock Value', value: `₹${totalValue.toFixed(0)}`, color: '#16a34a', icon: '💰' },
          { label: 'Total Purchases', value: purchases.length, color: '#9333ea', icon: '🛒' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `2px solid ${s.color}20`, borderRadius: 12, padding: '16px', borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
          ⚠️ <strong>Low Stock Alert:</strong> {lowStock.map(m => m.name).join(', ')} — need reorder
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['stock','purchases'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', border: 'none', borderBottom: tab === t ? '3px solid #2563eb' : '3px solid transparent', background: 'none', fontWeight: 600, fontSize: 14, color: tab === t ? '#2563eb' : '#64748b', cursor: 'pointer' }}>
            {t === 'stock' ? 'Current Stock' : 'Purchase History'}
          </button>
        ))}
      </div>

      {tab === 'stock' && <div className={styles.card}><Table columns={stockCols} data={medications} loading={loading} /></div>}
      {tab === 'purchases' && <div className={styles.card}><Table columns={purchaseCols} data={purchases} loading={false} emptyMessage="No purchases recorded yet" /></div>}

      {/* Stock Update Modal */}
      <Modal isOpen={!!stockModal} onClose={() => setStockModal(null)} title={`${stockModal?.op === 'add' ? 'Add' : 'Remove'} Stock — ${stockModal?.name}`} size="sm">
        <form onSubmit={handleStockUpdate} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
              Current Stock: <strong>{stockModal?.stockQuantity}</strong> units
            </div>
            <div className={styles.field}><label className={styles.label}>Quantity to {stockModal?.op === 'add' ? 'Add' : 'Remove'}</label>
              <input type="number" min={1} className={styles.input} value={stockModal?.qty || 1}
                onChange={e => setStockModal(s => ({...s, qty: e.target.value}))} required />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setStockModal(null)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Update Stock</button>
          </div>
        </form>
      </Modal>

      {/* Purchase Modal */}
      <Modal isOpen={purchaseModal} onClose={() => setPurchaseModal(false)} title="Record Medicine Purchase" size="lg">
        <form onSubmit={handlePurchase} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}><label className={styles.label}>Medication *</label>
              <select className={styles.input} value={purchaseForm.medicationId} onChange={e => { const m = medications.find(x => x.id === e.target.value); setPurchaseForm(f => ({...f, medicationId: e.target.value, unitCost: m?.unitPrice || 0})); }} required>
                <option value="">Select Medication</option>
                {medications.map(m => <option key={m.id} value={m.id}>{m.name} ({m.dosage})</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Vendor</label>
              <select className={styles.input} value={purchaseForm.vendorId} onChange={e => setPurchaseForm(f => ({...f, vendorId: e.target.value}))}>
                <option value="">Select Vendor</option>
                {vendors.filter(v=>v.isActive).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Quantity *</label><input type="number" min={1} className={styles.input} value={purchaseForm.quantity} onChange={e => setPurchaseForm(f => ({...f, quantity: e.target.value}))} required /></div>
            <div className={styles.field}><label className={styles.label}>Unit Cost (₹)</label><input type="number" step="0.01" className={styles.input} value={purchaseForm.unitCost} onChange={e => setPurchaseForm(f => ({...f, unitCost: e.target.value}))} /></div>
            <div className={styles.field}><label className={styles.label}>Invoice Number</label><input className={styles.input} value={purchaseForm.invoiceNumber} onChange={e => setPurchaseForm(f => ({...f, invoiceNumber: e.target.value}))} /></div>
            <div className={styles.field}><label className={styles.label}>Purchase Date</label><input type="date" className={styles.input} value={purchaseForm.purchaseDate} onChange={e => setPurchaseForm(f => ({...f, purchaseDate: e.target.value}))} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, fontSize: 14, color: '#15803d' }}>
                Total Cost: <strong>₹{(purchaseForm.quantity * purchaseForm.unitCost).toFixed(2)}</strong>
              </div>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Notes</label><textarea className={styles.input} rows={2} value={purchaseForm.notes} onChange={e => setPurchaseForm(f => ({...f, notes: e.target.value}))} /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setPurchaseModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Record Purchase</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
