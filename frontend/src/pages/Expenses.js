import React, { useState, useEffect } from 'react';
import { expenseAPI } from '../services/api';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const fmt = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = ['salary', 'supplies', 'utilities', 'equipment', 'rent', 'maintenance', 'other'];

const CAT_STYLE = {
  salary:      { background: '#dbeafe', color: '#1d4ed8' },
  supplies:    { background: '#dcfce7', color: '#15803d' },
  utilities:   { background: '#fef9c3', color: '#854d0e' },
  equipment:   { background: '#ede9fe', color: '#6d28d9' },
  rent:        { background: '#ffedd5', color: '#c2410c' },
  maintenance: { background: '#fce7f3', color: '#9d174d' },
  other:       { background: '#f1f5f9', color: '#475569' },
};

const CARD_BORDER = {
  salary: '#2563eb', supplies: '#16a34a', utilities: '#d97706',
  equipment: '#7c3aed', rent: '#ea580c', maintenance: '#db2777', other: '#64748b',
};

const INIT_FORM = { category: 'other', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', from: '', to: '' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(INIT_FORM);
  const [saving, setSaving] = useState(false);

  const load = (f = filters) => {
    setLoading(true);
    const params = {};
    if (f.category) params.category = f.category;
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    expenseAPI.getAll(params).then(r => setExpenses(r.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => load(filters);
  const resetFilters = () => {
    const f = { category: '', from: '', to: '' };
    setFilters(f);
    load(f);
  };

  const openAdd = () => { setEditTarget(null); setForm(INIT_FORM); setModalOpen(true); };
  const openEdit = (e) => {
    setEditTarget(e);
    setForm({ category: e.category, description: e.description, amount: e.amount, date: e.date, notes: e.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!form.description.trim() || !form.amount || !form.date) return toast.error('Fill all required fields');
    setSaving(true);
    try {
      if (editTarget) {
        await expenseAPI.update(editTarget.id, form);
        toast.success('Expense updated');
      } else {
        await expenseAPI.create(form);
        toast.success('Expense added');
      }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.response.data.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense')) return;
    try { await expenseAPI.delete(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  // Summary stats
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const byCat = CATEGORIES.reduce((acc, c) => {
    acc[c] = expenses.filter(e => e.category === c).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    return acc;
  }, {});
  const topCats = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Expenses</h2>
          <p className={styles.pageSubtitle}>Track clinic operating costs</p>
        </div>
        <button className={styles.btnPrimary} onClick={openAdd}>+ Add Expense</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className={styles.card} style={{ padding: '14px 18px', borderLeft: '4px solid #1e293b' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{fmt(total)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{expenses.length} entries</div>
        </div>
        {topCats.map(([cat, val]) => (
          <div key={cat} className={styles.card} style={{ padding: '14px 18px', borderLeft: `4px solid ${CARD_BORDER[cat] || '#94a3b8'}` }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>{fmt(val)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {expenses.filter(e => e.category === cat).length} entries
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <input type="date" className={styles.filterSelect} value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
        <input type="date" className={styles.filterSelect} value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        <button className={styles.btnPrimary} onClick={applyFilters}>Apply</button>
        <button className={styles.btnSecondary} onClick={resetFilters}>Reset</button>
      </div>

      {/* Table */}
      <div className={styles.card} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : expenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14 }}>No expenses recorded yet</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Date', 'Category', 'Description', 'Amount', 'Notes', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#475569' }}>
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        ...CAT_STYLE[e.category] || CAT_STYLE.other,
                        fontSize: 11, padding: '3px 10px', borderRadius: 999,
                        fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
                      }}>
                        {e.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 500 }}>{e.description}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{fmt(e.amount)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.notes || '-'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div className={styles.actions}>
                        <button className={styles.btnEdit} onClick={() => openEdit(e)}>Edit</button>
                        <button className={styles.btnDelete} onClick={() => handleDelete(e.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
        Showing {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
        {total > 0 && <>  |  Total: <strong style={{ color: '#1e293b' }}>{fmt(total)}</strong></>}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.grid2} style={{ marginBottom: 0 }}>
            <div className={styles.field}>
              <label className={styles.label}>Date *</label>
              <input type="date" className={styles.input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <select className={styles.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Description *</label>
              <input className={styles.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="e.g. Staff Salaries - February" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Amount (Rs ) *</label>
              <input type="number" min="0" step="0.01" className={styles.input} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.00" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <input className={styles.input} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
