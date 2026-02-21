import React, { useEffect, useState } from 'react';
import { appointmentAPI, corporateAPI, doctorAPI, packageAPI } from '../services/api';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const fmt = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_LABELS = {
  consultation: 'Consultation',
  procedure: 'Procedure',
  medication: 'Medication',
  lab_test: 'Lab Test',
  room_charge: 'Room Charge',
  other: 'Other',
};

const CLAIM_STATUSES = ['na', 'submitted', 'in_review', 'approved', 'rejected', 'settled'];
const CLAIM_TRANSITIONS = {
  na: ['submitted'],
  submitted: ['in_review', 'approved', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['settled', 'rejected'],
  rejected: ['submitted'],
  settled: [],
};

const QUICK_STATUS_LABEL = {
  submitted: 'Submit',
  in_review: 'Move Review',
  approved: 'Approve',
  settled: 'Settle',
  rejected: 'Reject',
};

const CLAIM_REJECTION_TEMPLATES = [
  'Policy inactive on treatment date',
  'Pre-authorization missing',
  'Non-covered procedure/medicine',
  'Insufficient supporting documents',
  'Claim amount mismatch with invoice',
  'Patient/member details mismatch',
];

const CLAIM_REQUIRED_DOCS = [
  { key: 'prescription', label: 'Prescription', tokens: ['prescription', 'rx'] },
  { key: 'invoice', label: 'Invoice/Bill Copy', tokens: ['invoice', 'bill'] },
  { key: 'idproof', label: 'Patient ID Proof', tokens: ['id proof', 'aadhaar', 'pan', 'passport'] },
  { key: 'insurance', label: 'Insurance Card/Policy', tokens: ['insurance card', 'policy', 'tpa card'] },
  { key: 'reports', label: 'Lab/Clinical Reports', tokens: ['report', 'lab', 'scan'] },
];
const CLAIM_STATUS_SLA_DAYS = {
  submitted: 3,
  in_review: 5,
  approved: 2,
};

const getClaimAgeDays = (submittedAt) => {
  if (!submittedAt) return null;
  const d = new Date(submittedAt);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)), 0);
};

const toDateOnly = (val) => {
  if (!val) return null;
  const d = new Date(`${val}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const getClaimFollowUpMeta = (claimStatus, claimSubmittedAt) => {
  const slaDays = CLAIM_STATUS_SLA_DAYS[claimStatus];
  const submittedDate = toDateOnly(claimSubmittedAt);
  if (!slaDays || !submittedDate) return { dueDate: null, daysToDue: null, priority: 'unknown' };
  const dueDate = new Date(submittedDate);
  dueDate.setDate(submittedDate.getDate() + slaDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let priority = 'on_track';
  if (daysToDue < -7) priority = 'critical';
  else if (daysToDue < 0) priority = 'overdue';
  else if (daysToDue === 0) priority = 'due_today';
  else if (daysToDue <= 2) priority = 'due_soon';
  return { dueDate: dueDate.toISOString().slice(0, 10), daysToDue, priority };
};

const CLAIM_PRIORITY_META = {
  critical: { label: 'Critical', color: '#b91c1c', bg: '#fef2f2' },
  overdue: { label: 'Overdue', color: '#c2410c', bg: '#fff7ed' },
  due_today: { label: 'Due Today', color: '#b45309', bg: '#fffbeb' },
  due_soon: { label: 'Due Soon', color: '#0369a1', bg: '#ecfeff' },
  on_track: { label: 'On Track', color: '#166534', bg: '#f0fdf4' },
  unknown: { label: 'No SLA', color: '#475569', bg: '#f8fafc' },
};

export default function Billing() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [corporates, setCorporates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickClaimLoadingId, setQuickClaimLoadingId] = useState('');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    doctorId: '',
    isPaid: '',
    billingType: '',
    claimStatus: '',
    claimPriority: '',
    patientName: '',
    patientPhone: '',
  });

  const [detailAppt, setDetailAppt] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [billLoading, setBillLoading] = useState(false);

  const [claimModal, setClaimModal] = useState(null);
  const [claimSaving, setClaimSaving] = useState(false);
  const [applyingPackageId, setApplyingPackageId] = useState('');
  const [claimForm, setClaimForm] = useState({
    billingType: 'insurance',
    insuranceProvider: '',
    policyNumber: '',
    claimNumber: '',
    claimStatus: 'submitted',
    claimAmount: '',
    approvedAmount: '',
    claimSubmittedAt: '',
    claimRejectionReason: '',
    claimSettlementDate: '',
    claimDocumentsText: '',
    corporateAccountId: '',
    corporateInvoiceNumber: '',
    corporateInvoiceDate: '',
    corporateDueDate: '',
    corporatePaymentStatus: 'unbilled',
    notes: '',
  });

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.dateFrom) params.from = filters.dateFrom;
    if (filters.dateTo) params.to = filters.dateTo;
    if (filters.doctorId) params.doctorId = filters.doctorId;
    if (filters.isPaid !== '') params.isPaid = filters.isPaid;
    if (filters.billingType) params.billingType = filters.billingType;
    if (filters.claimStatus) params.claimStatus = filters.claimStatus;
    if (filters.patientName) params.patientName = filters.patientName;
    if (filters.patientPhone) params.patientPhone = filters.patientPhone;

    Promise.all([appointmentAPI.getAll(params), doctorAPI.getAll(), corporateAPI.getAll({ isActive: true })])
      .then(([a, d, c]) => {
        const billed = (a.data || []).filter((r) =>
          Number(r.fee || 0) > 0 || Number(r.treatmentBill || 0) > 0 || r.isPaid || r.billingType === 'insurance'
        );
        setAppointments(billed);
        setDoctors(d.data || []);
        setCorporates(c.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const applyFilters = () => load();
  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      doctorId: '',
      isPaid: '',
      billingType: '',
      claimStatus: '',
      claimPriority: '',
      patientName: '',
      patientPhone: '',
    });
    setTimeout(load, 0);
  };

  const totalBilled = appointments.reduce((s, a) => s + Number(a.fee || 0) + Number(a.treatmentBill || 0), 0);
  const totalCollected = appointments.filter((a) => a.isPaid).reduce((s, a) => s + Number(a.fee || 0) + Number(a.treatmentBill || 0), 0);
  const totalPending = totalBilled - totalCollected;
  const insuranceBills = appointments.filter((a) => a.billingType === 'insurance');
  const submittedClaims = insuranceBills.filter((a) => ['submitted', 'in_review', 'approved', 'settled'].includes(a.claimStatus)).length;
  const pendingInsuranceClaims = insuranceBills.filter((a) => ['submitted', 'in_review', 'approved'].includes(a.claimStatus));
  const overdueClaims = pendingInsuranceClaims.filter((a) => {
    const age = getClaimAgeDays(a.claimSubmittedAt);
    if (age === null) return false;
    return age > 15;
  }).length;
  const approvedClaims = insuranceBills.filter((a) => ['approved', 'settled'].includes(a.claimStatus));
  const settledClaims = insuranceBills.filter((a) => a.claimStatus === 'settled');
  const claimApprovalRate = submittedClaims > 0 ? (approvedClaims.length / submittedClaims) * 100 : 0;
  const claimSettlementRate = approvedClaims.length > 0 ? (settledClaims.length / approvedClaims.length) * 100 : 0;
  const insuranceClaimRows = pendingInsuranceClaims
    .map((a) => {
      const ageDays = getClaimAgeDays(a.claimSubmittedAt);
      const total = Number(a.fee || 0) + Number(a.treatmentBill || 0);
      const claimAmt = Number(a.claimAmount || 0) || total;
      const followUp = getClaimFollowUpMeta(a.claimStatus || 'na', a.claimSubmittedAt);
      return { ...a, ageDays, claimAmt, followUp };
    })
    .filter((a) => {
      if (!filters.claimPriority) return true;
      return (a.followUp?.priority || 'unknown') === filters.claimPriority;
    })
    .sort((x, y) => Number(y.ageDays || -1) - Number(x.ageDays || -1));

  const openDetail = async (appt) => {
    setDetailAppt(appt);
    setBillItems([]);
    setBillLoading(true);
    try {
      const res = await appointmentAPI.getBillItems(appt.id);
      setBillItems(res.data || []);
    } catch {
      setBillItems([]);
    } finally {
      setBillLoading(false);
    }
  };

  const togglePaid = async (appt, e) => {
    e.stopPropagation();
    try {
      const res = await appointmentAPI.markPaid(appt.id);
      setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, isPaid: res.data.isPaid } : a)));
      if (detailAppt && detailAppt.id === appt.id) setDetailAppt((d) => ({ ...d, isPaid: res.data.isPaid }));
      toast.success(res.data.isPaid ? 'Marked as Paid' : 'Marked as Unpaid');
    } catch {
      toast.error('Failed to update payment status');
    }
  };

  const autoApplyPackage = async (appt, e) => {
    e.stopPropagation();
    if (!appt?.patient?.id) {
      return toast.error('Patient details are missing for this appointment');
    }
    setApplyingPackageId(appt.id);
    try {
      const pkgRes = await packageAPI.getPatientAssignments(appt.patient.id, { status: 'active' });
      const active = (pkgRes.data || []).find((x) => Number(x.usedVisits || 0) < Number(x.totalVisits || 0));
      if (!active) {
        setApplyingPackageId('');
        return toast.error('No active package with remaining visits for this patient');
      }

      await packageAPI.consumeVisit(active.id, {
        appointmentId: appt.id,
        notes: 'Auto-applied from billing',
      });
      toast.success(`Package applied: ${active.plan?.name || 'Plan'}`);
      load();
      if (detailAppt && detailAppt.id === appt.id) {
        openDetail({ ...appt });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply package');
    } finally {
      setApplyingPackageId('');
    }
  };

  const openClaimModal = (appt) => {
    setClaimModal(appt);
    setClaimForm({
      billingType: appt.billingType || 'insurance',
      insuranceProvider: appt.insuranceProvider || appt.patient?.insuranceProvider || '',
      policyNumber: appt.policyNumber || appt.patient?.insuranceNumber || '',
      claimNumber: appt.claimNumber || '',
      claimStatus: appt.claimStatus || 'submitted',
      claimAmount: Number(appt.claimAmount || 0) || Number(appt.fee || 0) + Number(appt.treatmentBill || 0),
      approvedAmount: Number(appt.approvedAmount || 0) || '',
      claimSubmittedAt: appt.claimSubmittedAt || '',
      claimRejectionReason: appt.claimRejectionReason || '',
      claimSettlementDate: appt.claimSettlementDate || '',
      claimDocumentsText: Array.isArray(appt.claimDocuments) ? appt.claimDocuments.join('\n') : '',
      corporateAccountId: appt.corporateAccountId || '',
      corporateInvoiceNumber: appt.corporateInvoiceNumber || '',
      corporateInvoiceDate: appt.corporateInvoiceDate || '',
      corporateDueDate: appt.corporateDueDate || '',
      corporatePaymentStatus: appt.corporatePaymentStatus || 'unbilled',
      notes: appt.notes || '',
    });
  };

  const saveClaim = async (e) => {
    e.preventDefault();
    if (!claimModal) return;
    setClaimSaving(true);
    try {
      const nextBillingType = claimForm.billingType || 'insurance';
      const nextStatus = nextBillingType === 'insurance' ? (claimForm.claimStatus || 'na') : 'na';
      const claimDocumentRows = String(claimForm.claimDocumentsText || '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);

      if (nextBillingType === 'insurance' && nextStatus !== 'na') {
        if (!String(claimForm.insuranceProvider || '').trim()) {
          setClaimSaving(false);
          return toast.error('Insurance provider is required for insurance claims');
        }
        if (!String(claimForm.policyNumber || '').trim()) {
          setClaimSaving(false);
          return toast.error('Policy number is required for insurance claims');
        }
        if (!String(claimForm.claimNumber || '').trim() && ['submitted', 'in_review', 'approved', 'settled'].includes(nextStatus)) {
          setClaimSaving(false);
          return toast.error('Claim number is required for submitted/in-review/approved/settled claims');
        }
        if (claimDocumentRows.length === 0 && ['submitted', 'in_review', 'approved', 'settled'].includes(nextStatus)) {
          setClaimSaving(false);
          return toast.error('At least one claim document reference is required before submission');
        }
      }
      if (nextBillingType === 'insurance' && nextStatus === 'rejected' && !String(claimForm.claimRejectionReason || '').trim()) {
        setClaimSaving(false);
        return toast.error('Rejection reason is required when claim is rejected');
      }

      const payload = {
        billingType: nextBillingType,
        insuranceProvider: claimForm.insuranceProvider || null,
        policyNumber: claimForm.policyNumber || null,
        claimNumber: claimForm.claimNumber || null,
        claimStatus: nextStatus,
        claimAmount: Number(claimForm.claimAmount || 0),
        approvedAmount: Number(claimForm.approvedAmount || 0),
        claimSubmittedAt: claimForm.claimSubmittedAt || (nextStatus !== 'na' ? new Date().toISOString().slice(0, 10) : null),
        claimRejectionReason: claimForm.claimRejectionReason || null,
        claimSettlementDate: claimForm.claimSettlementDate || null,
        claimDocuments: claimDocumentRows,
        notes: claimForm.notes || null,
      };
      let updated;
      if ((claimForm.billingType || 'insurance') === 'corporate') {
        const corpId = claimForm.corporateAccountId || null;
        if (!corpId) {
          setClaimSaving(false);
          return toast.error('Corporate account is required for corporate billing');
        }
        const apptRes = await appointmentAPI.update(claimModal.id, {
          billingType: 'corporate',
          corporateAccountId: corpId,
          corporateInvoiceNumber: claimForm.corporateInvoiceNumber || null,
          corporateInvoiceDate: claimForm.corporateInvoiceDate || null,
          corporateDueDate: claimForm.corporateDueDate || null,
          corporatePaymentStatus: claimForm.corporatePaymentStatus || 'unbilled',
          notes: claimForm.notes || null,
        });
        updated = apptRes.data || {};
        if (claimForm.corporatePaymentStatus === 'billed' && Number(claimForm.claimAmount || 0) > 0) {
          try {
            await corporateAPI.postInvoice(corpId, {
              appointmentId: claimModal.id,
              amount: Number(claimForm.claimAmount || 0),
              invoiceDate: claimForm.corporateInvoiceDate || null,
              dueDate: claimForm.corporateDueDate || null,
              invoiceNumber: claimForm.corporateInvoiceNumber || null,
              notes: claimForm.notes || null,
            });
          } catch {
            toast.info('Corporate appointment saved. Invoice posting failed; post it from Corporate Accounts ledger.');
          }
        }
      } else {
        const res = await appointmentAPI.updateClaim(claimModal.id, payload);
        updated = res.data || payload;
      }
      setAppointments((prev) => prev.map((a) => (a.id === claimModal.id ? { ...a, ...updated } : a)));
      if (detailAppt && detailAppt.id === claimModal.id) setDetailAppt((d) => ({ ...d, ...updated }));
      toast.success('Claim details updated');
      setClaimModal(null);
    } catch (err) {
      toast.error(err.response.data.message || 'Failed to update claim details');
    } finally {
      setClaimSaving(false);
    }
  };

  const claimDocumentRows = String(claimForm.claimDocumentsText || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  const claimDocumentText = claimDocumentRows.join(' ').toLowerCase();
  const claimDocChecklist = CLAIM_REQUIRED_DOCS.map((d) => ({
    ...d,
    done: d.tokens.some((token) => claimDocumentText.includes(token)),
  }));
  const claimDocDoneCount = claimDocChecklist.filter((d) => d.done).length;
  const claimDocPct = claimDocChecklist.length > 0 ? Math.round((claimDocDoneCount / claimDocChecklist.length) * 100) : 0;

  const getNextQuickClaimStatus = (appt) => {
    if ((appt.billingType || 'self_pay') !== 'insurance') return null;
    const current = appt.claimStatus || 'na';
    const allowed = CLAIM_TRANSITIONS[current] || [];
    const preferredOrder = ['submitted', 'in_review', 'approved', 'settled'];
    return preferredOrder.find((s) => allowed.includes(s)) || null;
  };

  const quickTransitionClaim = async (appt, nextStatus, e) => {
    e.stopPropagation();
    setQuickClaimLoadingId(appt.id);
    try {
      const total = Number(appt.fee || 0) + Number(appt.treatmentBill || 0);
      const claimAmount = Number(appt.claimAmount || 0) || total;
      const payload = {
        billingType: 'insurance',
        claimStatus: nextStatus,
        claimAmount,
      };
      if (nextStatus === 'submitted' && !appt.claimSubmittedAt) {
        payload.claimSubmittedAt = new Date().toISOString().slice(0, 10);
      }
      if (nextStatus === 'approved' || nextStatus === 'settled') {
        payload.approvedAmount = Number(appt.approvedAmount || 0) > 0 ? Number(appt.approvedAmount) : claimAmount;
      }
      if (nextStatus === 'settled') {
        payload.claimSettlementDate = new Date().toISOString().slice(0, 10);
      }

      const res = await appointmentAPI.updateClaim(appt.id, payload);
      const updated = res.data || payload;
      setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, ...updated } : a)));
      if (detailAppt && detailAppt.id === appt.id) setDetailAppt((d) => ({ ...d, ...updated }));
      toast.success(`Claim moved to ${nextStatus.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update claim status');
    } finally {
      setQuickClaimLoadingId('');
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Billing</h2>
          <p className={styles.pageSubtitle}>{appointments.length} billing records</p>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input type="date" className={styles.filterSelect} value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
        <input type="date" className={styles.filterSelect} value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
        <input
          className={styles.filterSelect}
          placeholder="Patient name"
          value={filters.patientName}
          onChange={(e) => setFilters((f) => ({ ...f, patientName: e.target.value }))}
        />
        <input
          className={styles.filterSelect}
          placeholder="Patient mobile"
          value={filters.patientPhone}
          onChange={(e) => setFilters((f) => ({ ...f, patientPhone: e.target.value }))}
        />
        <SearchableSelect
          className={styles.filterSelect}
          value={filters.doctorId}
          onChange={(v) => setFilters((f) => ({ ...f, doctorId: v }))}
          placeholder="Search doctor"
          emptyLabel="All Doctors"
          options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))}
        />
        <select className={styles.filterSelect} value={filters.isPaid} onChange={(e) => setFilters((f) => ({ ...f, isPaid: e.target.value }))}>
          <option value="">All Payment</option>
          <option value="true">Paid</option>
          <option value="false">Unpaid</option>
        </select>
        <select className={styles.filterSelect} value={filters.billingType} onChange={(e) => setFilters((f) => ({ ...f, billingType: e.target.value }))}>
          <option value="">All Payers</option>
          <option value="self_pay">Self Pay</option>
          <option value="insurance">Insurance</option>
          <option value="corporate">Corporate</option>
        </select>
        <select className={styles.filterSelect} value={filters.claimStatus} onChange={(e) => setFilters((f) => ({ ...f, claimStatus: e.target.value }))}>
          <option value="">All Claim Status</option>
          {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className={styles.filterSelect} value={filters.claimPriority} onChange={(e) => setFilters((f) => ({ ...f, claimPriority: e.target.value }))}>
          <option value="">All Claim Priority</option>
          <option value="critical">Critical</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due Today</option>
          <option value="due_soon">Due Soon</option>
          <option value="on_track">On Track</option>
          <option value="unknown">No SLA</option>
        </select>
        <button className={styles.btnPrimary} onClick={applyFilters}>Apply</button>
        <button className={styles.btnSecondary} onClick={resetFilters}>Reset</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Billed', value: fmt(totalBilled), color: '#2563eb', bg: '#eff6ff' },
          { label: 'Collected', value: fmt(totalCollected), color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Pending', value: fmt(totalPending), color: '#dc2626', bg: '#fef2f2' },
          { label: 'Insurance Bills', value: insuranceBills.length, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Claims Submitted', value: submittedClaims, color: '#0891b2', bg: '#ecfeff' },
          { label: 'Claims > 15 Days', value: overdueClaims, color: '#b45309', bg: '#fffbeb' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 12, padding: '16px 20px', border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
        {[
          { label: 'Pending Insurance Claims', value: insuranceClaimRows.length, color: '#0f766e', bg: '#ecfeff' },
          { label: 'Approval Rate', value: `${claimApprovalRate.toFixed(1)}%`, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Settlement Rate', value: `${claimSettlementRate.toFixed(1)}%`, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'High Priority (>30d)', value: insuranceClaimRows.filter((r) => Number(r.ageDays || 0) > 30).length, color: '#b91c1c', bg: '#fef2f2' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 12, padding: '12px 16px', border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className={styles.card} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Insurance Claim Worklist</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['critical', 'overdue', 'due_today', 'due_soon', 'on_track'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, claimPriority: f.claimPriority === k ? '' : k }))}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 999,
                  padding: '3px 9px',
                  fontSize: 11,
                  cursor: 'pointer',
                  background: filters.claimPriority === k ? CLAIM_PRIORITY_META[k].bg : '#fff',
                  color: CLAIM_PRIORITY_META[k].color,
                  fontWeight: 600,
                }}
              >
                {CLAIM_PRIORITY_META[k].label}
              </button>
            ))}
          </div>
        </div>
        {insuranceClaimRows.length === 0 ? (
          <div style={{ padding: '14px 12px', color: '#64748b', fontSize: 13 }}>No pending insurance claims.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Apt #', 'Patient', 'Claim #', 'Status', 'Amount', 'Age', 'Follow-up Due', 'Priority', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insuranceClaimRows.slice(0, 25).map((row) => {
                  const next = getNextQuickClaimStatus(row);
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{row.appointmentNumber || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{row.patient?.name || '-'}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{row.claimNumber || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{(row.claimStatus || 'na').replace('_', ' ')}</td>
                      <td style={{ padding: '8px 10px' }}>{fmt(row.claimAmt || 0)}</td>
                      <td style={{ padding: '8px 10px', color: Number(row.ageDays || 0) > 30 ? '#b91c1c' : '#475569', fontWeight: 600 }}>
                        {row.ageDays === null ? '-' : `${row.ageDays}d`}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>
                        {row.followUp?.dueDate || '-'}
                        {typeof row.followUp?.daysToDue === 'number' && (
                          <div style={{ fontSize: 11, color: row.followUp.daysToDue < 0 ? '#b91c1c' : '#94a3b8' }}>
                            {row.followUp.daysToDue < 0 ? `${Math.abs(row.followUp.daysToDue)}d late` : `${row.followUp.daysToDue}d left`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {(() => {
                          const p = CLAIM_PRIORITY_META[row.followUp?.priority || 'unknown'];
                          return (
                            <span style={{ background: p.bg, color: p.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                              {p.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {next ? (
                          <button
                            className={styles.btnEdit}
                            onClick={(e) => quickTransitionClaim(row, next, e)}
                            disabled={quickClaimLoadingId === row.id}
                          >
                            {quickClaimLoadingId === row.id ? 'Saving...' : (QUICK_STATUS_LABEL[next] || 'Next')}
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>No action</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className="flex justify-center p-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>No records</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Apt #', 'Patient', 'Doctor', 'Date', 'Payer', 'Claim', 'Total', 'Payment', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => {
                const total = Number(appt.fee || 0) + Number(appt.treatmentBill || 0);
                return (
                  <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{appt.appointmentNumber}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{appt.patient?.name || '-'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{appt.patient?.patientId || '-'}</div>
                      {(Array.isArray(appt.patient?.clinicalAlerts) && appt.patient.clinicalAlerts.length > 0) && (
                        <div style={{ marginTop: 3 }}>
                          <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                            Alert: {appt.patient.clinicalAlerts[0]}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{appt.doctor ? `Dr. ${appt.doctor.name}` : '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{appt.appointmentDate}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{(appt.billingType || 'self_pay').replace('_', ' ')}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {appt.billingType === 'insurance' ? (
                        <>
                          <div>{(appt.claimStatus || 'na').replace('_', ' ')}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            {appt.claimSubmittedAt ? `Submitted: ${appt.claimSubmittedAt}` : 'Not submitted'}
                          </div>
                          {(() => {
                            const followUp = getClaimFollowUpMeta(appt.claimStatus || 'na', appt.claimSubmittedAt);
                            const meta = CLAIM_PRIORITY_META[followUp.priority || 'unknown'];
                            return (
                              <div style={{ marginTop: 3 }}>
                                <span style={{ background: meta.bg, color: meta.color, borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                                  {meta.label}
                                </span>
                              </div>
                            );
                          })()}
                        </>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>{fmt(total)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background:appt.isPaid ? '#dcfce7' : '#fef3c7',
                          color:appt.isPaid ? '#16a34a' : '#b45309',
                        }}
                      >
                        {appt.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className={styles.btnSecondary} onClick={() => openDetail(appt)}>View</button>
                        <button className={styles.btnWarning} onClick={() => openClaimModal(appt)}>Claim</button>
                        {(() => {
                          const next = getNextQuickClaimStatus(appt);
                          if (!next) return null;
                          return (
                            <button
                              className={styles.btnEdit}
                              onClick={(e) => quickTransitionClaim(appt, next, e)}
                              disabled={quickClaimLoadingId === appt.id}
                            >
                              {quickClaimLoadingId === appt.id ? 'Saving...' : QUICK_STATUS_LABEL[next] || 'Next Step'}
                            </button>
                          );
                        })()}
                        <button className={styles.btnPrimary} onClick={(e) => autoApplyPackage(appt, e)} disabled={applyingPackageId === appt.id}>
                          {applyingPackageId === appt.id ? 'Applying...' : 'Apply Package'}
                        </button>
                        <button className={appt.isPaid ? styles.btnWarning : styles.btnSuccess} onClick={(e) => togglePaid(appt, e)}>
                          {appt.isPaid ? 'Undo Paid' : 'Mark Paid'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={!!detailAppt} onClose={() => setDetailAppt(null)} title="Bill Details" size="lg">
        {detailAppt && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
              {[
                ['Appointment #', detailAppt.appointmentNumber],
                ['Date', detailAppt.appointmentDate],
                ['Patient', detailAppt.patient?.name || '-'],
                ['Patient ID', detailAppt.patient?.patientId || '-'],
                ['Doctor', detailAppt.doctor ? `Dr. ${detailAppt.doctor.name}` : '-'],
                ['Billing Type', (detailAppt.billingType || 'self_pay').replace('_', ' ')],
                ['Claim Status', (detailAppt.claimStatus || 'na').replace('_', ' ')],
                ['Claim Amount', fmt(detailAppt.claimAmount || 0)],
                ['Approved Amount', fmt(detailAppt.approvedAmount || 0)],
                ['Rejection Reason', detailAppt.claimRejectionReason || '-'],
                ['Settlement Date', detailAppt.claimSettlementDate || '-'],
                ['Corporate Account', detailAppt.corporateAccount?.name || '-'],
                ['Corporate Pay Status', detailAppt.corporatePaymentStatus || '-'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{value || '-'}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10 }}>Bill Items</div>
              {billLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                </div>
              ) : (
                <>
                  {Number(detailAppt.fee || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#eff6ff', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                      <div><span style={{ fontWeight: 600, color: '#1e40af' }}>Consultation Fee</span></div>
                      <span style={{ fontWeight: 700, color: '#1e40af' }}>{fmt(detailAppt.fee)}</span>
                    </div>
                  )}
                  {billItems.map((item, idx) => (
                    <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: '#374151' }}>{item.description}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 11, color: '#94a3b8' }}>
                          <span style={{ background: '#e2e8f0', borderRadius: 8, padding: '0px 6px' }}>{CATEGORY_LABELS[item.category] || item.category}</span>
                          <span>{`Qty: ${item.quantity} x Rs ${Number(item.unitPrice || 0).toFixed(2)}`}</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: '#374151', marginLeft: 16 }}>{fmt(item.amount)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!claimModal} onClose={() => setClaimModal(null)} title="Insurance / TPA Claim" size="lg">
        {claimModal && (
          <form onSubmit={saveClaim} className={styles.form}>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Billing Type</label>
                <select className={styles.input} value={claimForm.billingType} onChange={(e) => setClaimForm((f) => ({ ...f, billingType: e.target.value }))}>
                  <option value="self_pay">Self Pay</option>
                  <option value="insurance">Insurance</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Claim Status</label>
                <select className={styles.input} value={claimForm.claimStatus} onChange={(e) => setClaimForm((f) => ({ ...f, claimStatus: e.target.value }))}>
                  {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              {(claimForm.billingType || 'insurance') === 'corporate' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Corporate Account *</label>
                    <SearchableSelect
                      className={styles.input}
                      value={claimForm.corporateAccountId}
                      onChange={(v) => setClaimForm((f) => ({ ...f, corporateAccountId: v }))}
                      placeholder="Search corporate account"
                      emptyLabel="Select corporate account"
                      options={corporates.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Corporate Payment Status</label>
                    <select className={styles.input} value={claimForm.corporatePaymentStatus} onChange={(e) => setClaimForm((f) => ({ ...f, corporatePaymentStatus: e.target.value }))}>
                      {['unbilled', 'billed', 'partially_paid', 'paid'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Corporate Invoice Number</label>
                    <input className={styles.input} value={claimForm.corporateInvoiceNumber} onChange={(e) => setClaimForm((f) => ({ ...f, corporateInvoiceNumber: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Corporate Invoice Date</label>
                    <input type="date" className={styles.input} value={claimForm.corporateInvoiceDate} onChange={(e) => setClaimForm((f) => ({ ...f, corporateInvoiceDate: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Corporate Due Date</label>
                    <input type="date" className={styles.input} value={claimForm.corporateDueDate} onChange={(e) => setClaimForm((f) => ({ ...f, corporateDueDate: e.target.value }))} />
                  </div>
                </>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Insurance Provider</label>
                <input className={styles.input} value={claimForm.insuranceProvider} onChange={(e) => setClaimForm((f) => ({ ...f, insuranceProvider: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Policy Number</label>
                <input className={styles.input} value={claimForm.policyNumber} onChange={(e) => setClaimForm((f) => ({ ...f, policyNumber: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Claim Number</label>
                <input className={styles.input} value={claimForm.claimNumber} onChange={(e) => setClaimForm((f) => ({ ...f, claimNumber: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Claim Submitted Date</label>
                <input type="date" className={styles.input} value={claimForm.claimSubmittedAt} onChange={(e) => setClaimForm((f) => ({ ...f, claimSubmittedAt: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Claim Amount</label>
                <input type="number" min="0" step="0.01" className={styles.input} value={claimForm.claimAmount} onChange={(e) => setClaimForm((f) => ({ ...f, claimAmount: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Approved Amount</label>
                <input type="number" min="0" step="0.01" className={styles.input} value={claimForm.approvedAmount} onChange={(e) => setClaimForm((f) => ({ ...f, approvedAmount: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Rejection Reason</label>
                <input className={styles.input} value={claimForm.claimRejectionReason} onChange={(e) => setClaimForm((f) => ({ ...f, claimRejectionReason: e.target.value }))} />
              </div>
              {(claimForm.billingType || 'insurance') === 'insurance' && (claimForm.claimStatus || 'na') === 'rejected' && (
                <div className={styles.field}>
                  <label className={styles.label}>Rejection Template</label>
                  <select
                    className={styles.input}
                    value=""
                    onChange={(e) => {
                      const value = e.target.value || '';
                      if (!value) return;
                      setClaimForm((f) => ({ ...f, claimRejectionReason: value }));
                    }}
                  >
                    <option value="">Select template</option>
                    {CLAIM_REJECTION_TEMPLATES.map((tpl) => <option key={tpl} value={tpl}>{tpl}</option>)}
                  </select>
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Settlement Date</label>
                <input type="date" className={styles.input} value={claimForm.claimSettlementDate} onChange={(e) => setClaimForm((f) => ({ ...f, claimSettlementDate: e.target.value }))} />
              </div>
              <div className={styles.field} style={{ gridColumn: 'span 2' }}>
                <label className={styles.label}>Claim Documents (one reference per line)</label>
                <textarea className={styles.input} rows={3} value={claimForm.claimDocumentsText} onChange={(e) => setClaimForm((f) => ({ ...f, claimDocumentsText: e.target.value }))} />
              </div>
              {(claimForm.billingType || 'insurance') === 'insurance' && (
                <div className={styles.field} style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className={styles.label} style={{ marginBottom: 0 }}>Claim Document Checklist</label>
                    <span style={{ fontSize: 12, color: claimDocPct >= 80 ? '#15803d' : '#b45309', fontWeight: 700 }}>
                      {claimDocPct}% complete
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ width: `${claimDocPct}%`, background: claimDocPct >= 80 ? '#22c55e' : '#f59e0b', height: '100%' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 6 }}>
                    {claimDocChecklist.map((d) => (
                      <div
                        key={d.key}
                        style={{
                          border: `1px solid ${d.done ? '#bbf7d0' : '#e2e8f0'}`,
                          background: d.done ? '#f0fdf4' : '#f8fafc',
                          color: d.done ? '#166534' : '#475569',
                          borderRadius: 8,
                          padding: '6px 8px',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {d.done ? 'OK' : 'Pending'} {d.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.field} style={{ gridColumn: 'span 2' }}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.input} rows={3} value={claimForm.notes} onChange={(e) => setClaimForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setClaimModal(null)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={claimSaving}>{claimSaving ? 'Saving...' : 'Save Claim'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
