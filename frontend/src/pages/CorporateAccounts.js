import React, { useEffect, useState } from 'react';
import { appointmentAPI, corporateAPI } from '../services/api';
import Table from '../components/Table';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT = {
  name: '',
  accountCode: '',
  gstin: '',
  contactPerson: '',
  phone: '',
  email: '',
  creditDays: 30,
  creditLimit: 0,
  openingBalance: 0,
  notes: '',
};

const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function CorporateAccounts() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);

  const [ledgerModal, setLedgerModal] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [invoiceAppointments, setInvoiceAppointments] = useState([]);
  const [invoiceAppointmentsLoading, setInvoiceAppointmentsLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: '', referenceNumber: '', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ appointmentId: '', amount: '', invoiceDate: '', dueDate: '', invoiceNumber: '', notes: '' });

  const loadInvoiceAppointments = async (corporateAccountId) => {
    setInvoiceAppointmentsLoading(true);
    try {
      const from = new Date(Date.now() - (45 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
      const res = await appointmentAPI.getAll({ from });
      const rows = Array.isArray(res.data) ? res.data : [];

      const eligible = rows
        .filter((a) => {
          const linkedCorporateId = a?.corporateAccountId || a?.corporateAccount?.id || null;
          return !linkedCorporateId || linkedCorporateId === corporateAccountId;
        })
        .slice(0, 200)
        .map((a) => {
          const patientName = a?.patient?.name || 'Unknown Patient';
          const date = a?.appointmentDate || '-';
          const time = a?.appointmentTime ? String(a.appointmentTime).slice(0, 5) : '--:--';
          const number = a?.appointmentNumber || a?.id;
          return {
            value: String(a.id),
            label: `${number} | ${patientName} | ${date} ${time}`,
          };
        });

      setInvoiceAppointments(eligible);
    } catch (err) {
      setInvoiceAppointments([]);
      toast.error(err?.response?.data?.message || 'Failed to load recent appointments');
    } finally {
      setInvoiceAppointmentsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await corporateAPI.getAll();
      setAccounts(res.data || []);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to load corporate accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(INIT);
    setModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || '',
      accountCode: row.accountCode || '',
      gstin: row.gstin || '',
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      creditDays: Number(row.creditDays || 30),
      creditLimit: Number(row.creditLimit || 0),
      openingBalance: Number(row.openingBalance || 0),
      notes: row.notes || '',
    });
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        creditDays: Number(form.creditDays || 30),
        creditLimit: Number(form.creditLimit || 0),
        openingBalance: Number(form.openingBalance || 0),
      };
      if (editing) await corporateAPI.update(editing.id, payload);
      else await corporateAPI.create(payload);
      toast.success(editing ? 'Corporate account updated' : 'Corporate account created');
      setModal(false);
      await load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to save corporate account');
    }
  };

  const archive = async (row) => {
    if (!window.confirm(`Archive ${row.name}`)) return;
    try {
      await corporateAPI.remove(row.id);
      toast.success('Corporate account archived');
      await load();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to archive account');
    }
  };

  const openLedger = async (row) => {
    setLedgerModal(row);
    setLedgerLoading(true);
    setLedgerData(null);
    setInvoiceAppointments([]);
    setPaymentForm({ amount: '', paymentDate: '', referenceNumber: '', notes: '' });
    setInvoiceForm({ appointmentId: '', amount: '', invoiceDate: '', dueDate: '', invoiceNumber: '', notes: '' });
    try {
      const [ledgerRes] = await Promise.all([
        corporateAPI.getLedger(row.id),
        loadInvoiceAppointments(row.id),
      ]);
      setLedgerData(ledgerRes.data || null);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const refreshLedger = async () => {
    if (!ledgerModal) return;
    const res = await corporateAPI.getLedger(ledgerModal.id);
    setLedgerData(res.data || null);
    await load();
  };

  const postPayment = async (e) => {
    e.preventDefault();
    if (!ledgerModal) return;
    try {
      await corporateAPI.postPayment(ledgerModal.id, {
        amount: Number(paymentForm.amount || 0),
        paymentDate: paymentForm.paymentDate || null,
        referenceNumber: paymentForm.referenceNumber || null,
        notes: paymentForm.notes || null,
      });
      toast.success('Payment posted');
      setPaymentForm({ amount: '', paymentDate: '', referenceNumber: '', notes: '' });
      await refreshLedger();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to post payment');
    }
  };

  const postInvoice = async (e) => {
    e.preventDefault();
    if (!ledgerModal) return;
    try {
      await corporateAPI.postInvoice(ledgerModal.id, {
        appointmentId: invoiceForm.appointmentId,
        amount: Number(invoiceForm.amount || 0),
        invoiceDate: invoiceForm.invoiceDate || null,
        dueDate: invoiceForm.dueDate || null,
        invoiceNumber: invoiceForm.invoiceNumber || null,
        notes: invoiceForm.notes || null,
      });
      toast.success('Corporate invoice posted');
      setInvoiceForm({ appointmentId: '', amount: '', invoiceDate: '', dueDate: '', invoiceNumber: '', notes: '' });
      await refreshLedger();
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to post invoice');
    }
  };

  const columns = [
    { key: 'name', label: 'Corporate Account' },
    { key: 'accountCode', label: 'Code', render: (v) => v || '-' },
    { key: 'contactPerson', label: 'Contact', render: (v, r) => v || r.phone || '-' },
    { key: 'creditDays', label: 'Credit Days' },
    { key: 'creditLimit', label: 'Credit Limit', render: (v) => money(v) },
    { key: 'ledgerSummary', label: 'Outstanding', render: (v) => <strong>{money(v.outstanding || 0)}</strong> },
    {
      key: 'id',
      label: 'Actions',
      render: (_, r) => (
        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={() => openLedger(r)}>Ledger</button>
          <button className={styles.btnEdit} onClick={() => openEdit(r)}>Edit</button>
          <button className={styles.btnDelete} onClick={() => archive(r)}>Archive</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Corporate Accounts</h2>
          <p className={styles.pageSubtitle}>Credit contracts, invoices, and payment ledger</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Add Corporate</button>
      </div>

      <div className={styles.card}>
        <Table columns={columns} data={accounts} loading={loading} emptyMessage="No corporate accounts found" />
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Corporate Account' : 'Create Corporate Account'} size="lg">
        <form onSubmit={submit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field}><label className={styles.label}>Name *</label><input className={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
            <div className={styles.field}><label className={styles.label}>Account Code</label><input className={styles.input} value={form.accountCode} onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>GSTIN</label><input className={styles.input} value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Contact Person</label><input className={styles.input} value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Phone</label><input className={styles.input} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Email</label><input className={styles.input} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Credit Days</label><input type="number" className={styles.input} value={form.creditDays} onChange={(e) => setForm((f) => ({ ...f, creditDays: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Credit Limit</label><input type="number" step="0.01" className={styles.input} value={form.creditLimit} onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Opening Balance</label><input type="number" step="0.01" className={styles.input} value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} /></div>
            <div className={styles.field}><label className={styles.label}>Notes</label><input className={styles.input} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!ledgerModal} onClose={() => setLedgerModal(null)} title={`Corporate Ledger${ledgerModal ? ` - ${ledgerModal.name}` : ''}`} size="lg">
        {ledgerLoading ? (
          <div style={{ padding: 20 }}>Loading...</div>
        ) : !ledgerData ? (
          <div style={{ padding: 20 }}>No ledger data</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div><div style={{ fontSize: 11, color: '#64748b' }}>Opening</div><strong>{money(ledgerData.summary.openingBalance)}</strong></div>
              <div><div style={{ fontSize: 11, color: '#64748b' }}>Debit</div><strong>{money(ledgerData.summary.totalDebit)}</strong></div>
              <div><div style={{ fontSize: 11, color: '#64748b' }}>Credit</div><strong>{money(ledgerData.summary.totalCredit)}</strong></div>
              <div><div style={{ fontSize: 11, color: '#64748b' }}>Outstanding</div><strong>{money(ledgerData.summary.outstanding)}</strong></div>
            </div>

            <div className={styles.grid2}>
              <form onSubmit={postInvoice} className={styles.card} style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Post Invoice</div>
                <div className={styles.field}>
                  <label className={styles.label}>Choose Recent Appointment</label>
                  <SearchableSelect
                    className={styles.input}
                    value={invoiceAppointments.find((o) => o.value === invoiceForm.appointmentId) ? invoiceForm.appointmentId : ''}
                    onChange={(value) => setInvoiceForm((f) => ({ ...f, appointmentId: value || '' }))}
                    options={invoiceAppointments}
                    placeholder={invoiceAppointmentsLoading ? 'Loading appointments...' : 'Search by appointment #, patient, date'}
                    emptyLabel="Select Appointment"
                    allowEmpty
                    disabled={invoiceAppointmentsLoading}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Appointment ID / Number *</label>
                  <input
                    className={styles.input}
                    placeholder="UUID or APT-XXXXXX"
                    value={invoiceForm.appointmentId}
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, appointmentId: e.target.value }))}
                    required
                  />
                </div>
                <div className={styles.field}><label className={styles.label}>Amount *</label><input type="number" step="0.01" className={styles.input} value={invoiceForm.amount} onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))} required /></div>
                <div className={styles.field}><label className={styles.label}>Invoice Date</label><input type="date" className={styles.input} value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))} /></div>
                <div className={styles.field}><label className={styles.label}>Due Date</label><input type="date" className={styles.input} value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
                <div className={styles.field}><label className={styles.label}>Invoice Number</label><input className={styles.input} value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))} /></div>
                <div className={styles.field}><label className={styles.label}>Notes</label><input className={styles.input} value={invoiceForm.notes} onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <button type="submit" className={styles.btnPrimary}>Post Invoice</button>
              </form>

              <form onSubmit={postPayment} className={styles.card} style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Post Payment</div>
                <div className={styles.field}><label className={styles.label}>Amount *</label><input type="number" step="0.01" className={styles.input} value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} required /></div>
                <div className={styles.field}><label className={styles.label}>Payment Date</label><input type="date" className={styles.input} value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))} /></div>
                <div className={styles.field}><label className={styles.label}>Reference Number</label><input className={styles.input} value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm((f) => ({ ...f, referenceNumber: e.target.value }))} /></div>
                <div className={styles.field}><label className={styles.label}>Notes</label><input className={styles.input} value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <button type="submit" className={styles.btnSuccess}>Post Payment</button>
              </form>
            </div>

            <div className={styles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Date', 'Type', 'Reference', 'Appointment', 'Debit', 'Credit', 'Notes'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ledgerData.entries || []).map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px' }}>{e.entryDate}</td>
                      <td style={{ padding: '8px 10px' }}>{e.entryType}</td>
                      <td style={{ padding: '8px 10px' }}>{e.referenceNumber || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{e.appointment?.appointmentNumber || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{money(e.debitAmount)}</td>
                      <td style={{ padding: '8px 10px' }}>{money(e.creditAmount)}</td>
                      <td style={{ padding: '8px 10px' }}>{e.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
