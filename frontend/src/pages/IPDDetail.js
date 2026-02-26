import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipdAPI, doctorAPI, packageAPI, nurseAPI, shiftAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import styles from './Page.module.css';

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  admitted:    { background: '#dcfce7', color: '#15803d' },
  discharged:  { background: '#dbeafe', color: '#1d4ed8' },
  transferred: { background: '#fef9c3', color: '#854d0e' },
};

const PAYMENT_STATUS_STYLE = {
  pending: { background: '#fef9c3', color: '#854d0e' },
  partial: { background: '#ffedd5', color: '#c2410c' },
  paid:    { background: '#dcfce7', color: '#15803d' },
};

const NOTE_TYPE_STYLE = {
  progress:     { background: '#dbeafe', color: '#1d4ed8' },
  nursing:      { background: '#dcfce7', color: '#15803d' },
  orders:       { background: '#fef9c3', color: '#854d0e' },
  consultation: { background: '#ede9fe', color: '#6d28d9' },
};

const GST_DEFAULTS = {
  room_charges: 0, consultation: 0, procedure: 5, lab_test: 0,
  medication: 5, ot_charges: 5, nursing: 0, equipment: 12, other: 0,
  medicine: 5, patient_expense: 12,
};

const ITEM_TYPES = ['room_charges', 'consultation', 'procedure', 'lab_test', 'medication', 'ot_charges', 'nursing', 'equipment', 'other', 'medicine', 'patient_expense'];
const PAYMENT_METHODS = ['cash', 'card', 'upi', 'insurance', 'corporate', 'cheque', 'online', 'other'];

const INIT_NOTE = { noteType: 'progress', content: '', doctorId: '' };
const INIT_DISCHARGE = { dischargeDate: todayStr(), finalDiagnosis: '', conditionAtDischarge: 'stable', dischargeNotes: '', isPaid: false };
const INIT_ITEM = { itemType: 'other', description: '', quantity: 1, unitPrice: 0, gstRate: 0, isPackageCovered: false, packageId: '', date: todayStr(), notes: '' };
const INIT_PAYMENT = { amount: '', paymentMethod: 'cash', referenceNumber: '', paymentDate: todayStr(), notes: '' };

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function IPDDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState('overview');
  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [patientPackages, setPatientPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [insights, setInsights] = useState(null);

  // Notes
  const [noteForm, setNoteForm] = useState(INIT_NOTE);
  const [addingNote, setAddingNote] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);

  // Discharge
  const [dischargeForm, setDischargeForm] = useState(INIT_DISCHARGE);
  const [discharging, setDischarging] = useState(false);
  const [showDischargeForm, setShowDischargeForm] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Billing
  const [bill, setBill] = useState({ billItems: [], payments: [], summary: {} });
  const [billLoading, setBillLoading] = useState(false);
  const [itemForm, setItemForm] = useState({ ...INIT_ITEM, open: false, editing: null });
  const [paymentForm, setPaymentForm] = useState({ ...INIT_PAYMENT, open: false });
  const [savingItem, setSavingItem] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [discount, setDiscount] = useState('');

  // Nurses
  const [nurseAssignments, setNurseAssignments] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [showAssignNurse, setShowAssignNurse] = useState(false);
  const [assignNurseForm, setAssignNurseForm] = useState({ nurseId: '', shiftId: '', notes: '' });
  const [assigningNurse, setAssigningNurse] = useState(false);

  const load = () => {
    setLoading(true);
    ipdAPI.getAdmission(id)
      .then(r => {
        setAdmission(r.data);
        loadPatientPackages(r.data.patientId);
        requestInsights(r.data.hospitalId);
        setDischargeForm(f => ({
          ...f,
          finalDiagnosis: r.data.finalDiagnosis || '',
          dischargeDate: r.data.dischargeDate || todayStr(),
          conditionAtDischarge: r.data.conditionAtDischarge || 'stable',
          dischargeNotes: r.data.dischargeNotes || '',
          isPaid: r.data.isPaid || false,
        }));
        setDiscount(r.data.discountAmount || '');
      })
      .catch(() => toast.error('Failed to load admission'))
      .finally(() => setLoading(false));
  };

  const requestInsights = (hospitalId) => {
    if (!hospitalId) {
      setInsights(null);
      return;
    }
    ipdAPI.getStats({ hospitalId })
      .then((r) => setInsights(r.data || null))
      .catch(() => setInsights(null));
  };

  async function loadPatientPackages(patientId) {
    if (!patientId) {
      setPatientPackages([]);
      return;
    }
    setPackagesLoading(true);
    try {
      const res = await packageAPI.getPatientAssignments(patientId);
      setPatientPackages(res.data || []);
    } catch {
      setPatientPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }

  const loadBill = () => {
    setBillLoading(true);
    ipdAPI.getBill(id).then(r => setBill(r.data)).catch(() => {}).finally(() => setBillLoading(false));
  };

  useEffect(() => {
    load();
    if (user.role !== 'doctor') {
      doctorAPI.getAll().then(r => setDoctors(r.data?.doctors || r.data || [])).catch(() => {});
    }
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if ((showDischargeForm || showSummaryModal) && bill.billItems.length === 0 && !billLoading) {
      loadBill();
    }
  }, [showDischargeForm, showSummaryModal]); // eslint-disable-line

  const handleTabChange = (t) => {
    setTab(t);
    if (t === 'billing' && bill.billItems.length === 0 && !billLoading) loadBill();
    if (t === 'nurses') loadNursingInfo();
  };

  const loadNursingInfo = async () => {
    try {
      const [aRes, nRes, sRes] = await Promise.all([
        ipdAPI.getNurses(id),
        nurseAPI.getAll(),
        shiftAPI.getAll()
      ]);
      setNurseAssignments(aRes.data);
      setNurses(nRes.data);
      setShifts(sRes.data);
    } catch {
      toast.error('Failed to load nursing info');
    }
  };

  // ─── Notes ────────────────────────────────────────────────────────────────────
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteForm.content.trim()) return toast.error('Note content is required');
    if (user.role !== 'nurse' && user.role !== 'doctor' && !noteForm.doctorId && !noteForm.nurseId) {
      return toast.error('Attribution required');
    }
    setAddingNote(true);
    try {
      await ipdAPI.addNote(id, noteForm);
      toast.success('Note added');
      setNoteForm(INIT_NOTE);
      setShowNoteForm(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setAddingNote(false); }
  };

  // ─── Discharge ────────────────────────────────────────────────────────────────
  const handleDischarge = async (e) => {
    e.preventDefault();
    if (!dischargeForm.dischargeDate) return toast.error('Discharge date required');
    setDischarging(true);
    try {
      await ipdAPI.discharge(id, dischargeForm);
      toast.success('Patient discharged successfully');
      setShowDischargeForm(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setDischarging(false); }
  };

  // ─── Billing helpers ──────────────────────────────────────────────────────────
  const openNewItem = () => setItemForm({ ...INIT_ITEM, gstRate: GST_DEFAULTS['other'], open: true, editing: null });
  const openEditItem = (item) => setItemForm({
    open: true, editing: item.id,
    itemType: item.itemType, description: item.description,
    quantity: item.quantity, unitPrice: item.unitPrice, gstRate: item.gstRate,
    isPackageCovered: item.isPackageCovered, packageId: item.packageId || '',
    date: item.date || todayStr(), notes: item.notes || '',
  });

  const prefillRoomCharges = () => {
    const days = Math.max(1, Math.round((new Date() - new Date(admission.admissionDate)) / 86400000));
    setItemForm({
      open: true, editing: null, itemType: 'room_charges',
      description: `Room Charges — ${admission.room?.roomNumber || 'N/A'} (${days} day(s))`,
      quantity: days, unitPrice: parseFloat(admission.room?.pricePerDay || 0),
      gstRate: 0, isPackageCovered: false, packageId: '', date: todayStr(), notes: '',
    });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.description) return toast.error('Description required');
    setSavingItem(true);
    const payload = {
      itemType: itemForm.itemType, description: itemForm.description,
      quantity: itemForm.quantity, unitPrice: itemForm.unitPrice, gstRate: itemForm.gstRate,
      isPackageCovered: itemForm.isPackageCovered,
      packageId: itemForm.packageId || null,
      date: itemForm.date, notes: itemForm.notes,
    };
    try {
      if (itemForm.editing) {
        await ipdAPI.updateBillItem(id, itemForm.editing, payload);
        toast.success('Item updated');
      } else {
        await ipdAPI.addBillItem(id, payload);
        toast.success('Item added');
      }
      setItemForm({ ...INIT_ITEM, open: false, editing: null });
      loadBill();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setSavingItem(false); }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this bill item?')) return;
    try {
      await ipdAPI.deleteBillItem(id, itemId);
      toast.success('Deleted');
      loadBill();
    } catch { toast.error('Failed'); }
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) return toast.error('Valid amount required');
    setSavingPayment(true);
    try {
      await ipdAPI.addPayment(id, paymentForm);
      toast.success('Payment recorded');
      setPaymentForm({ ...INIT_PAYMENT, open: false });
      loadBill();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setSavingPayment(false); }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      await ipdAPI.deletePayment(id, paymentId);
      toast.success('Deleted');
      loadBill();
    } catch { toast.error('Failed'); }
  };

  const handleSaveDiscount = async () => {
    try {
      await ipdAPI.updateDiscount(id, { discountAmount: parseFloat(discount) || 0 });
      toast.success('Discount updated');
      loadBill();
    } catch { toast.error('Failed'); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const getDays = (from, to) => Math.max(0, Math.floor(((to ? new Date(to) : new Date()) - new Date(from)) / 86400000));
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'Rs 0';
    return `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };
  const formatPercent = (value) => {
    if (typeof value === 'number') return `${value.toFixed(1)}%`;
    if (typeof value === 'string' && value.trim().length) return value;
    return '-';
  };

  // Live preview for item form
  const itemQty = parseFloat(itemForm.quantity) || 0;
  const itemPrice = parseFloat(itemForm.unitPrice) || 0;
  const itemGst = parseFloat(itemForm.gstRate) || 0;
  const itemAmt = itemQty * itemPrice;
  const itemGstAmt = itemAmt * itemGst / 100;
  const itemTotal = itemAmt + itemGstAmt;

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading...</div>;
  if (!admission) return <div style={{ textAlign: 'center', padding: 60, color: '#dc2626' }}>Admission not found.</div>;

  const notes = [...(admission.ipdNotes || [])].sort((a, b) => new Date(b.noteDate) - new Date(a.noteDate));
  const { summary } = bill;
  const isAdmin = ['super_admin', 'admin', 'receptionist'].includes(user.role);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/ipd')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 14 }}>
              ← Back to IPD
            </button>
            <span style={{ color: '#94a3b8' }}>|</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{admission.admissionNumber}</span>
            <span style={{ ...STATUS_STYLE[admission.status], borderRadius: 999, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
              {admission.status.toUpperCase()}
            </span>
            {admission.paymentStatus && (
              <span style={{ ...PAYMENT_STATUS_STYLE[admission.paymentStatus], borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                Bill: {admission.paymentStatus.toUpperCase()}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 8 }}>{admission.patient?.name}</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Admitted {formatDate(admission.admissionDate)}
            {admission.room && ` · Room ${admission.room.roomNumber} (${admission.room.roomType})`}
            {` · ${getDays(admission.admissionDate, admission.dischargeDate)} day(s)`}
        </div>
        {insights && (
          <div className={styles.strip}>
            {[
              { label: 'Total Admitted', value: insights.totalAdmitted, note: `${insights.dischargedToday ?? 0} discharged today` },
              { label: 'Pending Dues', value: formatCurrency(insights.pendingDues), note: 'Balances awaiting payment' },
              { label: 'Occupancy', value: formatPercent(insights.occupancyRate), note: `${insights.availableBeds ?? 0} beds available` },
              { label: '30d Revenue', value: formatCurrency(insights.revenueThisMonth), note: `GST ${formatCurrency(insights.gstCollected)}` },
            ].map((item) => (
              <div key={item.label} className={styles.stripItem}>
                <div className={styles.stripLabel}>{item.label}</div>
                <div className={styles.stripValue}>{item.value ?? '-'}</div>
                <div className={styles.stripNote}>{item.note}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Patient packages</div>
          {packagesLoading ? (
            <div className={styles.stripItem} style={{ borderStyle: 'dashed' }}>Loading packages…</div>
          ) : patientPackages.length > 0 ? (
            <div className={styles.strip}>
              {patientPackages.map((pkg) => {
                const totalVisits = Number(pkg.totalVisits || 0);
                const usedVisits = Number(pkg.usedVisits || 0);
                const remaining = Math.max(totalVisits - usedVisits, 0);
                const status = pkg.status ? pkg.status.toUpperCase() : 'N/A';
                return (
                  <div key={pkg.id} className={styles.stripItem}>
                    <div className={styles.stripLabel}>{pkg.plan?.name || 'Package'}</div>
                    <div className={styles.stripValue}>{`${usedVisits}/${totalVisits} used`}</div>
                    <div className={styles.stripNote}>
                      {`${remaining} remaining • ${status}`}
                      {pkg.expiryDate ? ` • Expires ${formatDate(pkg.expiryDate)}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No packages assigned to this patient.</div>
          )}
        </div>
      </div>
        {admission.status === 'admitted' && (
          <button className={styles.btnPrimary} style={{ background: '#dc2626', borderColor: '#dc2626' }}
            onClick={() => setShowDischargeForm(v => !v)}>
            Discharge Patient
          </button>
        )}
      </div>

      {/* Discharge Form */}
      {showDischargeForm && admission.status === 'admitted' && (
        <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#dc2626', marginBottom: 16 }}>Discharge Patient</h3>
          <form onSubmit={handleDischarge} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label className={styles.label}>Discharge Date *</label>
                <input className={styles.input} type="date" value={dischargeForm.dischargeDate}
                  onChange={e => setDischargeForm(f => ({ ...f, dischargeDate: e.target.value }))} /></div>
              <div><label className={styles.label}>Condition at Discharge</label>
                <select className={styles.input} value={dischargeForm.conditionAtDischarge}
                  onChange={e => setDischargeForm(f => ({ ...f, conditionAtDischarge: e.target.value }))}>
                  <option value="stable">Stable</option>
                  <option value="improved">Improved</option>
                  <option value="lama">LAMA</option>
                  <option value="expired">Expired</option>
                  <option value="transferred">Transferred</option>
                </select></div>
            </div>
            <div><label className={styles.label}>Final Diagnosis</label>
              <textarea className={styles.input} rows={2} value={dischargeForm.finalDiagnosis}
                onChange={e => setDischargeForm(f => ({ ...f, finalDiagnosis: e.target.value }))} /></div>
            <div><label className={styles.label}>Discharge Notes</label>
              <textarea className={styles.input} rows={2} value={dischargeForm.dischargeNotes}
                onChange={e => setDischargeForm(f => ({ ...f, dischargeNotes: e.target.value }))}
                placeholder="Treatment summary, advice..." /></div>
            {bill.summary?.balance > 0 && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c2410c', fontWeight: 600 }}>
                ⚠ Balance Due: {fmt(bill.summary.balance)}. Patient has unpaid dues.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={dischargeForm.isPaid}
                  onChange={e => setDischargeForm(f => ({ ...f, isPaid: e.target.checked }))} />
                Mark as Fully Paid
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowDischargeForm(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} style={{ background: '#dc2626' }} disabled={discharging}>
                {discharging ? 'Discharging...' : 'Confirm Discharge'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[['overview','Overview'],['notes',`Notes (${notes.length})`],['nurses','Nurses'],['billing','Billing']].map(([t, label]) => (
          <button key={t} onClick={() => handleTabChange(t)}
            style={{ padding: '8px 20px', border: 'none', borderBottom: tab === t ? '3px solid #2563eb' : '3px solid transparent', background: 'none', fontWeight: 600, fontSize: 14, color: tab === t ? '#2563eb' : '#64748b', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ─── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className={styles.card} style={{ padding: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Patient Information</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Patient ID</div><div className={styles.infoValue}>{admission.patient?.patientId || '—'}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Phone</div><div className={styles.infoValue}>{admission.patient?.phone || '—'}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Gender</div><div className={styles.infoValue}>{admission.patient?.gender || '—'}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Blood Group</div><div className={styles.infoValue}>{admission.patient?.bloodGroup || '—'}</div></div>
                <div className={styles.infoItem} style={{ gridColumn: 'span 2' }}>
                  <div className={styles.infoLabel}>Allergies</div>
                  <div className={styles.infoValue} style={{ color: admission.patient?.allergies ? '#dc2626' : undefined }}>
                    {admission.patient?.allergies || 'None recorded'}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card} style={{ padding: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Admission Details</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Doctor</div><div className={styles.infoValue}>Dr. {admission.doctor?.name}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Type</div><div className={styles.infoValue}>{admission.admissionType}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Room</div><div className={styles.infoValue}>{admission.room ? `Room ${admission.room.roomNumber} (${admission.room.roomType})` : '—'}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Floor</div><div className={styles.infoValue}>{admission.room?.floor || '—'}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Admitted</div><div className={styles.infoValue}>{formatDate(admission.admissionDate)}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Discharged</div><div className={styles.infoValue}>{formatDate(admission.dischargeDate)}</div></div>
                <div className={styles.infoItem} style={{ gridColumn: 'span 2' }}>
                  <div className={styles.infoLabel}>Admission Diagnosis</div>
                  <div className={styles.infoValue}>{admission.admissionDiagnosis || '—'}</div>
                </div>
                {admission.finalDiagnosis && (
                  <div className={styles.infoItem} style={{ gridColumn: 'span 2' }}>
                    <div className={styles.infoLabel}>Final Diagnosis</div>
                    <div className={styles.infoValue}>{admission.finalDiagnosis}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {admission.status === 'discharged' && (
            <div className={styles.card} style={{ padding: 20, marginTop: 20, background: '#f0fdf4', border: '1px solid #86efac' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontWeight: 700, fontSize: 15, color: '#15803d', margin: 0 }}>Discharge Summary</h2>
                <button className={styles.btnSecondary} style={{ fontSize: 13 }} onClick={() => setShowSummaryModal(true)}>
                  Print Summary
                </button>
              </div>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Discharged On</div><div className={styles.infoValue}>{formatDate(admission.dischargeDate)}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Condition</div><div className={styles.infoValue}>{admission.conditionAtDischarge || '—'}</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Total Days</div><div className={styles.infoValue}>{getDays(admission.admissionDate, admission.dischargeDate)} days</div></div>
                <div className={styles.infoItem}><div className={styles.infoLabel}>Payment Status</div><div className={styles.infoValue}>{admission.paymentStatus || (admission.isPaid ? 'paid' : 'pending')}</div></div>
                {admission.dischargeNotes && (
                  <div className={styles.infoItem} style={{ gridColumn: 'span 2' }}>
                    <div className={styles.infoLabel}>Discharge Notes</div>
                    <div className={styles.infoValue}>{admission.dischargeNotes}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Notes Tab ─── */}
      {tab === 'notes' && (
        <div className={styles.card} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15 }}>Clinical Notes</h2>
            {!showNoteForm && (
              <button className={styles.btnPrimary} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setShowNoteForm(true)}>
                + Add Note
              </button>
            )}
          </div>
          {showNoteForm && (
            <form onSubmit={handleAddNote} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className={styles.label}>Note Type</label>
                  <select className={styles.input} value={noteForm.noteType}
                    onChange={e => setNoteForm(f => ({ ...f, noteType: e.target.value }))}>
                    <option value="progress">Progress Note</option>
                    <option value="nursing">Nursing Note</option>
                    <option value="orders">Doctor Orders</option>
                    <option value="consultation">Consultation</option>
                  </select></div>
                {user.role !== 'doctor' && (
                  <div><label className={styles.label}>Doctor *</label>
                    <select className={styles.input} value={noteForm.doctorId}
                      onChange={e => setNoteForm(f => ({ ...f, doctorId: e.target.value }))}>
                      <option value="">Select doctor...</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                    </select></div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {user.role === 'nurse' && (
                  <div style={{ background: '#dcfce7', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    Adding note as Nurse
                  </div>
                )}
                {user.role === 'doctor' && (
                  <div style={{ background: '#dbeafe', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                    Adding note as Doctor
                  </div>
                )}
                {(!['nurse', 'doctor'].includes(user.role)) && (
                   <div style={{ background: '#fef3c7', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                      Staff attribution will be logged.
                   </div>
                )}
              </div>
              <div><label className={styles.label}>Note Content *</label>
                <textarea className={styles.input} rows={3} value={noteForm.content} required
                  onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Enter clinical note..." /></div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowNoteForm(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={addingNote}>{addingNote ? 'Adding...' : 'Add Note'}</button>
              </div>
            </form>
          )}
          {notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>No clinical notes yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map(note => (
                <div key={note.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ ...NOTE_TYPE_STYLE[note.noteType], borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {note.noteType.charAt(0).toUpperCase() + note.noteType.slice(1)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                        {note.doctor?.name ? `Dr. ${note.doctor.name}` : note.nurse?.name ? `Nurse ${note.nurse.name}` : 'Unknown'}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateTime(note.noteDate || note.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{note.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Nurses Tab ─── */}
      {tab === 'nurses' && (
        <div className={styles.card} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15 }}>Nursing Care & Assignments</h2>
            {isAdmin && (
              <button className={styles.btnPrimary} style={{ fontSize: 13 }} onClick={() => setShowAssignNurse(true)}>
                + Assign Nurse
              </button>
            )}
          </div>

          {showAssignNurse && (
            <div style={{ background: '#f0fdfa', border: '1px solid #5eead4', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f766e', marginBottom: 12 }}>New Assignment</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setAssigningNurse(true);
                try {
                  await ipdAPI.assignNurse(id, assignNurseForm);
                  toast.success('Nurse assigned');
                  setShowAssignNurse(false);
                  loadNursingInfo();
                } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
                finally { setAssigningNurse(false); }
              }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className={styles.label}>Nurse *</label>
                  <select className={styles.input} value={assignNurseForm.nurseId} onChange={e => setAssignNurseForm({ ...assignNurseForm, nurseId: e.target.value })} required>
                    <option value="">Select Nurse...</option>
                    {nurses.map(n => <option key={n.id} value={n.id}>{n.name} ({n.specialization})</option>)}
                  </select>
                </div>
                <div>
                  <label className={styles.label}>Shift (Optional)</label>
                  <select className={styles.input} value={assignNurseForm.shiftId} onChange={e => setAssignNurseForm({ ...assignNurseForm, shiftId: e.target.value })}>
                    <option value="">Current Shift...</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={styles.label}>Notes</label>
                  <input className={styles.input} value={assignNurseForm.notes} onChange={e => setAssignNurseForm({ ...assignNurseForm, notes: e.target.value })} placeholder="Responsibilities..." />
                </div>
                <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowAssignNurse(false)}>Cancel</button>
                  <button type="submit" className={styles.btnPrimary} style={{ background: '#0f766e' }} disabled={assigningNurse}>Confirm Assignment</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '10px', color: '#64748b', fontWeight: 600 }}>Nurse Name</th>
                  <th style={{ padding: '10px', color: '#64748b', fontWeight: 600 }}>Shift</th>
                  <th style={{ padding: '10px', color: '#64748b', fontWeight: 600 }}>Assigned At</th>
                  <th style={{ padding: '10px', color: '#64748b', fontWeight: 600 }}>Status</th>
                  {isAdmin && <th style={{ padding: '10px', color: '#64748b', fontWeight: 600 }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {nurseAssignments.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{a.nurse?.name}</td>
                    <td style={{ padding: '10px' }}>{a.shift?.name || 'Manual'}</td>
                    <td style={{ padding: '10px' }}>{formatDateTime(a.assignedAt)}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: a.removedAt ? '#f1f5f9' : '#dcfce7', color: a.removedAt ? '#64748b' : '#15803d', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {a.removedAt ? 'HISTORY' : 'ACTIVE'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '10px' }}>
                        {!a.removedAt && (
                          <button className="text-red-500 text-xs font-bold hover:underline" onClick={async () => {
                            if (!window.confirm('Remove this nursing assignment?')) return;
                            try {
                              await ipdAPI.removeNurse(id, a.id);
                              toast.success('Nurse removed');
                              loadNursingInfo();
                            } catch { toast.error('Error'); }
                          }}>REMOVE</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {nurseAssignments.length === 0 && (
                  <tr><td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No nurses assigned to this patient yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Billing Tab ─── */}
      {/* ─── Discharge Summary Modal ─── */}
      {showSummaryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 820, margin: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <style>{`@media print { .no-print { display: none !important; } body { margin: 0; } }`}</style>

            {/* Modal Header Buttons */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Discharge Summary</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className={styles.btnPrimary} onClick={() => window.print()}>Print</button>
                <button className={styles.btnSecondary} onClick={() => setShowSummaryModal(false)}>Close</button>
              </div>
            </div>

            {/* Printable Content */}
            <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>
              {/* Hospital header */}
              <div style={{ textAlign: 'center', marginBottom: 16, borderBottom: '2px solid #1e293b', paddingBottom: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{admission.hospital?.name || 'Hospital'}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>DISCHARGE SUMMARY</div>
              </div>

              {/* Patient + Admission Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div><b>Patient:</b> {admission.patient?.name}</div>
                <div><b>Patient ID:</b> {admission.patient?.patientId || '—'}</div>
                <div><b>Gender:</b> {admission.patient?.gender || '—'}</div>
                <div><b>Blood Group:</b> {admission.patient?.bloodGroup || '—'}</div>
                <div style={{ gridColumn: 'span 2' }}><b>Allergies:</b> <span style={{ color: admission.patient?.allergies ? '#dc2626' : undefined }}>{admission.patient?.allergies || 'None recorded'}</span></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div><b>Admission No:</b> {admission.admissionNumber}</div>
                <div><b>Doctor:</b> Dr. {admission.doctor?.name || '—'}</div>
                <div><b>Admitted:</b> {formatDate(admission.admissionDate)}</div>
                <div><b>Discharged:</b> {formatDate(admission.dischargeDate)}</div>
                <div><b>Stay Duration:</b> {getDays(admission.admissionDate, admission.dischargeDate)} day(s)</div>
                <div><b>Room:</b> {admission.room ? `${admission.room.roomNumber} (${admission.room.roomType})` : '—'}</div>
                <div style={{ gridColumn: 'span 2' }}><b>Admission Diagnosis:</b> {admission.admissionDiagnosis || '—'}</div>
                {admission.finalDiagnosis && <div style={{ gridColumn: 'span 2' }}><b>Final Diagnosis:</b> {admission.finalDiagnosis}</div>}
                <div><b>Condition at Discharge:</b> {admission.conditionAtDischarge || '—'}</div>
              </div>

              {/* Bill Items */}
              {bill.billItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>Bill Items</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        {['Type', 'Description', 'Qty', 'Rate', 'GST%', 'GST₹', 'Total', 'PKG'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Type' || h === 'Description' ? 'left' : 'right', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bill.billItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 8px' }}>{item.itemType.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '5px 8px' }}>{item.description}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{Number(item.quantity)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{Number(item.gstRate)}%</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmt(item.gstAmount)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(item.totalWithGst)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.isPackageCovered ? 'PKG' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Package Coverage Note */}
              {bill.billItems.some(i => i.isPackageCovered) && (
                <div style={{ marginBottom: 16, padding: 10, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, fontSize: 12 }}>
                  <b style={{ color: '#15803d' }}>Package Covered Items (PKG):</b>
                  <div style={{ marginTop: 4, color: '#166534' }}>
                    {bill.billItems.filter(i => i.isPackageCovered).map(i => i.description).join(', ')}
                  </div>
                  <div style={{ marginTop: 4, color: '#64748b', fontStyle: 'italic' }}>
                    Package-covered items are for reference. They are tracked against the patient's package plan.
                  </div>
                </div>
              )}

              {/* Payments */}
              {bill.payments.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>Payments Received</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        {['Date', 'Method', 'Reference', 'Amount'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Amount' ? 'right' : 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bill.payments.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 8px' }}>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'}</td>
                          <td style={{ padding: '5px 8px' }}>{p.paymentMethod?.toUpperCase()}</td>
                          <td style={{ padding: '5px 8px', color: '#64748b' }}>{p.referenceNumber || '—'}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{fmt(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bill Summary */}
              <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>Bill Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    ['Subtotal', fmt(bill.summary?.subtotal)],
                    ['GST', fmt(bill.summary?.gstTotal)],
                    ['Total Billed', fmt(bill.summary?.billedAmount)],
                    ['Discount', fmt(bill.summary?.discountAmount)],
                    ['Paid', fmt(bill.summary?.paidAmount)],
                    ['Balance Due', fmt(bill.summary?.balance)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>{label}:</span>
                      <span style={{ fontWeight: 600, color: label === 'Balance Due' ? '#dc2626' : '#1e293b' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discharge Notes */}
              {admission.dischargeNotes && (
                <div style={{ marginBottom: 8, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                  <b>Discharge Notes:</b>
                  <div style={{ marginTop: 4 }}>{admission.dischargeNotes}</div>
                </div>
              )}

              <div style={{ marginTop: 20, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                Generated on {new Date().toLocaleString('en-IN')} — {admission.hospital?.name || 'Hospital'}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <div>
          {billLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading bill...</div>
          ) : (
            <>
              {/* Summary */}
              <div className={styles.card} style={{ padding: 20, marginBottom: 16, background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ fontWeight: 700, fontSize: 15, color: '#0369a1' }}>Bill Summary</h2>
                  {summary.paymentStatus && (
                    <span style={{ ...PAYMENT_STATUS_STYLE[summary.paymentStatus], borderRadius: 999, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
                      {summary.paymentStatus?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  {[
                    ['Subtotal', fmt(summary.subtotal)],
                    ['GST', fmt(summary.gstTotal)],
                    ['Total Billed', fmt(summary.billedAmount)],
                    ['Discount', fmt(summary.discountAmount)],
                    ['Paid', fmt(summary.paidAmount)],
                    ['Balance Due', fmt(summary.balance)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ textAlign: 'center', background: '#fff', borderRadius: 10, padding: '10px 8px', boxShadow: '0 1px 4px #0001' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: label === 'Balance Due' ? '#dc2626' : '#1e293b' }}>{val}</div>
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label className={styles.label} style={{ margin: 0, minWidth: 80 }}>Discount ₹</label>
                    <input className={styles.input} type="number" min={0} step="0.01" value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      style={{ maxWidth: 130, padding: '6px 10px' }} />
                    <button className={styles.btnSecondary} style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleSaveDiscount}>
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Bill Items */}
              <div className={styles.card} style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 700, fontSize: 15 }}>Bill Items ({bill.billItems.length})</h2>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={styles.btnSecondary} style={{ fontSize: 13 }} onClick={prefillRoomCharges}>
                        ⚡ Room Charges
                      </button>
                      <button className={styles.btnPrimary} style={{ fontSize: 13 }} onClick={openNewItem}>
                        + Add Item
                      </button>
                    </div>
                  )}
                </div>

                {/* Add/Edit Item Form */}
                {itemForm.open && (
                  <form onSubmit={handleSaveItem} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 80px 100px 80px', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className={styles.label}>Type</label>
                        <select className={styles.input} value={itemForm.itemType}
                          onChange={e => setItemForm(f => ({ ...f, itemType: e.target.value, gstRate: GST_DEFAULTS[e.target.value] ?? 0 }))}>
                          {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={styles.label}>Description *</label>
                        <input className={styles.input} value={itemForm.description} required
                          onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
                      </div>
                      <div>
                        <label className={styles.label}>Qty</label>
                        <input className={styles.input} type="number" min={0} step="0.001" value={itemForm.quantity}
                          onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                      <div>
                        <label className={styles.label}>Unit Price ₹</label>
                        <input className={styles.input} type="number" min={0} step="0.01" value={itemForm.unitPrice}
                          onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
                      </div>
                      <div>
                        <label className={styles.label}>GST %</label>
                        <input className={styles.input} type="number" min={0} max={100} step="0.5" value={itemForm.gstRate}
                          onChange={e => setItemForm(f => ({ ...f, gstRate: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className={styles.label}>Date</label>
                        <input className={styles.input} type="date" value={itemForm.date}
                          onChange={e => setItemForm(f => ({ ...f, date: e.target.value }))} />
                      </div>
                      <div>
                        <label className={styles.label}>Notes</label>
                        <input className={styles.input} value={itemForm.notes}
                          onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 2 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" checked={itemForm.isPackageCovered}
                            onChange={e => setItemForm(f => ({ ...f, isPackageCovered: e.target.checked }))} />
                          Package Covered
                        </label>
                      </div>
                    </div>
                    <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                      Preview: {fmt(itemAmt)} + GST {fmt(itemGstAmt)} = <strong>{fmt(itemTotal)}</strong>
                    </div>
                    <div className={styles.formActions}>
                      <button type="button" className={styles.btnSecondary}
                        onClick={() => setItemForm({ ...INIT_ITEM, open: false, editing: null })}>Cancel</button>
                      <button type="submit" className={styles.btnPrimary} disabled={savingItem}>
                        {savingItem ? 'Saving...' : itemForm.editing ? 'Update Item' : 'Add Item'}
                      </button>
                    </div>
                  </form>
                )}

                {bill.billItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>No bill items yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                          {['Type', 'Description', 'Qty', 'Rate', 'Amount', 'GST%', 'GST₹', 'Total', 'Date', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bill.billItems.map(item => (
                          <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {item.itemType.replace('_', ' ')}
                              </span>
                              {item.isPackageCovered && <span style={{ marginLeft: 4, background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>PKG</span>}
                            </td>
                            <td style={{ padding: '8px 10px', maxWidth: 200 }}>{item.description}{item.notes && <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.notes}</div>}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(item.quantity)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(item.amount)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Number(item.gstRate)}%</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>{fmt(item.gstAmount)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{fmt(item.totalWithGst)}</td>
                            <td style={{ padding: '8px 10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{item.date ? new Date(item.date).toLocaleDateString('en-IN') : '—'}</td>
                            {isAdmin && (
                              <td style={{ padding: '8px 10px' }}>
                                <div className={styles.actions}>
                                  <button className={styles.btnEdit} style={{ fontSize: 11 }} onClick={() => openEditItem(item)}>✎</button>
                                  <button className={styles.btnDelete} style={{ fontSize: 11 }} onClick={() => handleDeleteItem(item.id)}>✕</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Package Coverage Section */}
              {bill.billItems.some(i => i.isPackageCovered) && (
                <div className={styles.card} style={{ padding: 20, marginBottom: 16, background: '#f0fdf4', border: '1px solid #86efac' }}>
                  <h2 style={{ fontWeight: 700, fontSize: 15, color: '#15803d', marginBottom: 12 }}>
                    Package Coverage
                  </h2>
                  <div style={{ fontSize: 13, color: '#166534', marginBottom: 10 }}>
                    {bill.billItems.filter(i => i.isPackageCovered).length} item(s) are flagged as Package Covered (PKG).
                    These are tracked against the patient's package plan — they are included in the bill for reference but may be covered by the package.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bill.billItems.filter(i => i.isPackageCovered).map(item => {
                      const pkg = patientPackages.find(p => String(p.id) === String(item.packageId));
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #bbf7d0' }}>
                          <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>PKG</span>
                          <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{item.description}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{fmt(item.totalWithGst)}</span>
                          {pkg && <span style={{ fontSize: 11, color: '#0369a1', background: '#e0f2fe', borderRadius: 4, padding: '2px 8px' }}>{pkg.plan?.name || 'Package'}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {patientPackages.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: '#166534' }}>
                      Active Packages: {patientPackages.map(p => p.plan?.name).filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Payments */}
              <div className={styles.card} style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 700, fontSize: 15 }}>Payment History ({bill.payments.length})</h2>
                  {isAdmin && (
                    <button className={styles.btnPrimary} style={{ fontSize: 13 }}
                      onClick={() => setPaymentForm({ ...INIT_PAYMENT, open: true })}>
                      + Record Payment
                    </button>
                  )}
                </div>

                {paymentForm.open && (
                  <form onSubmit={handleSavePayment} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className={styles.label}>Amount ₹ *</label>
                        <input className={styles.input} type="number" min={0.01} step="0.01" value={paymentForm.amount} required
                          onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                      <div>
                        <label className={styles.label}>Method</label>
                        <select className={styles.input} value={paymentForm.paymentMethod}
                          onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={styles.label}>Reference # (optional)</label>
                        <input className={styles.input} value={paymentForm.referenceNumber}
                          onChange={e => setPaymentForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="UPI txn, Cheque #..." />
                      </div>
                      <div>
                        <label className={styles.label}>Date</label>
                        <input className={styles.input} type="date" value={paymentForm.paymentDate}
                          onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label className={styles.label}>Notes</label>
                      <input className={styles.input} value={paymentForm.notes}
                        onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div className={styles.formActions}>
                      <button type="button" className={styles.btnSecondary}
                        onClick={() => setPaymentForm({ ...INIT_PAYMENT, open: false })}>Cancel</button>
                      <button type="submit" className={styles.btnPrimary} disabled={savingPayment}>
                        {savingPayment ? 'Saving...' : 'Record Payment'}
                      </button>
                    </div>
                  </form>
                )}

                {bill.payments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>No payments recorded yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                          {['Date', 'Method', 'Amount', 'Reference', 'Recorded By', 'Notes', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bill.payments.map(p => (
                          <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                                {p.paymentMethod?.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#15803d' }}>{fmt(p.amount)}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.referenceNumber || '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.recordedBy?.name || '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.notes || '—'}</td>
                            {isAdmin && (
                              <td style={{ padding: '8px 10px' }}>
                                <button className={styles.btnDelete} style={{ fontSize: 11 }} onClick={() => handleDeletePayment(p.id)}>✕</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
