import React, { useEffect, useMemo, useState } from 'react';
import { appointmentAPI, packageAPI, patientAPI } from '../services/api';
import Table from '../components/Table';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT_PLAN = {
  name: '',
  serviceType: 'consultation',
  totalVisits: 5,
  price: 0,
  validityDays: 30,
  discountType: 'none',
  discountValue: 0,
  notes: '',
  isActive: true,
};

const currency = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PackagePlans() {
  const [tab, setTab] = useState('plans');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [usageLog, setUsageLog] = useState([]);
  const [usageSummary, setUsageSummary] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageFilter, setUsageFilter] = useState({ from: '', to: '', patientId: '' });

  const [planModal, setPlanModal] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState(INIT_PLAN);

  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({
    packagePlanId: '',
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [planRes, anRes, patRes] = await Promise.all([
        packageAPI.getPlans(),
        packageAPI.getAnalytics(),
        patientAPI.getAll(),
      ]);
      setPlans(planRes.data || []);
      setAnalytics(anRes.data || null);
      const p = patRes.data || [];
      setPatients(p);
      if (!patientId && p.length) setPatientId(p[0].id);
    } catch {
      toast.error('Failed to load package data');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientContext = async (pid) => {
    if (!pid) {
      setAssignments([]);
      setAppointments([]);
      return;
    }
    try {
      const [a1, a2] = await Promise.all([
        packageAPI.getPatientAssignments(pid),
        appointmentAPI.getAll({ patientId: pid }),
      ]);
      setAssignments(a1.data || []);
      setAppointments((a2.data || []).filter((x) => !['cancelled', 'no_show'].includes(x.status)));
    } catch {
      toast.error('Failed to load patient package assignments');
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadPatientContext(patientId); }, [patientId]);

  const loadUsageLog = async (next = usageFilter) => {
    setUsageLoading(true);
    try {
      const params = {};
      if (next.from) params.from = next.from;
      if (next.to) params.to = next.to;
      if (next.patientId) params.patientId = next.patientId;
      const res = await packageAPI.getUsageLog(params);
      setUsageLog(res.data?.data || []);
      setUsageSummary(res.data?.summary || null);
    } catch {
      toast.error('Failed to load package usage log');
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'usage') loadUsageLog();
  }, [tab]);

  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanForm(INIT_PLAN);
    setPlanModal(true);
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name || '',
      serviceType: plan.serviceType || 'consultation',
      totalVisits: Number(plan.totalVisits || 1),
      price: Number(plan.price || 0),
      validityDays: Number(plan.validityDays || 30),
      discountType: plan.discountType || 'none',
      discountValue: Number(plan.discountValue || 0),
      notes: plan.notes || '',
      isActive: plan.isActive !== false,
    });
    setPlanModal(true);
  };

  const savePlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim()) return toast.error('Plan name is required');
    setPlanSaving(true);
    try {
      const payload = {
        ...planForm,
        totalVisits: Number(planForm.totalVisits || 1),
        price: Number(planForm.price || 0),
        validityDays: Number(planForm.validityDays || 30),
        discountValue: Number(planForm.discountValue || 0),
      };
      if (editingPlan) await packageAPI.updatePlan(editingPlan.id, payload);
      else await packageAPI.createPlan(payload);
      toast.success(editingPlan ? 'Plan updated' : 'Plan created');
      setPlanModal(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const assignPlan = async (e) => {
    e.preventDefault();
    if (!patientId || !assignForm.packagePlanId) return toast.error('Select patient and plan');
    setAssigning(true);
    try {
      await packageAPI.assignToPatient({
        patientId,
        packagePlanId: assignForm.packagePlanId,
        startDate: assignForm.startDate,
        notes: assignForm.notes || null,
      });
      toast.success('Package assigned to patient');
      setAssignForm({ packagePlanId: '', startDate: new Date().toISOString().slice(0, 10), notes: '' });
      await Promise.all([load(), loadPatientContext(patientId)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign package');
    } finally {
      setAssigning(false);
    }
  };

  const consume = async (assignment) => {
    const apptId = window.prompt('Optional: Appointment ID to tag this usage (leave blank for manual consume)');
    const notes = window.prompt('Optional note for this package usage') || '';
    try {
      await packageAPI.consumeVisit(assignment.id, {
        appointmentId: apptId || null,
        notes: notes || null,
      });
      toast.success('Package visit consumed');
      await Promise.all([load(), loadPatientContext(patientId)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to consume package visit');
    }
  };

  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);

  const planCols = [
    { key: 'name', label: 'Plan' },
    { key: 'serviceType', label: 'Type', render: (v) => String(v || '').replace('_', ' ') },
    { key: 'totalVisits', label: 'Visits' },
    { key: 'validityDays', label: 'Validity (Days)' },
    { key: 'price', label: 'Price', render: (v) => currency(v) },
    { key: 'discountType', label: 'Discount', render: (v, r) => v === 'none' ? '-' : `${r.discountValue} ${v === 'percent' ? '%' : 'Rs'}` },
    { key: 'isActive', label: 'Status', render: (v) => v ? 'Active' : 'Inactive' },
    { key: 'id', label: 'Actions', render: (_, row) => <button className={styles.btnEdit} onClick={() => openEditPlan(row)}>Edit</button> },
  ];

  const assignmentCols = [
    { key: 'plan', label: 'Plan', render: (v) => v?.name || '-' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start' },
    { key: 'expiryDate', label: 'Expiry' },
    { key: 'usedVisits', label: 'Used', render: (v, r) => `${v}/${r.totalVisits}` },
    { key: 'purchaseAmount', label: 'Amount', render: (v) => currency(v) },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className={styles.actions}>
          {row.status === 'active' && Number(row.usedVisits || 0) < Number(row.totalVisits || 0) && (
            <button className={styles.btnSuccess} onClick={() => consume(row)}>Consume Visit</button>
          )}
        </div>
      ),
    },
  ];

  const selectedPatient = patients.find((p) => p.id === patientId);
  const usageCols = [
    { key: 'consumedAt', label: 'Consumed At', render: (v) => new Date(v).toLocaleString() },
    { key: 'patient', label: 'Patient', render: (v) => v ? `${v.name} (${v.patientId})` : '-' },
    { key: 'plan', label: 'Plan', render: (v) => v?.name || '-' },
    { key: 'appointment', label: 'Appointment', render: (v) => v?.appointmentNumber || '-' },
    { key: 'consumedBy', label: 'Consumed By', render: (v) => v?.name || '-' },
    { key: 'notes', label: 'Notes', render: (v) => v || '-' },
  ];

  const exportUsageCsv = () => {
    if (!usageLog.length) return toast.info('No usage log rows to export');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Consumed At',
      'Patient Name',
      'Patient ID',
      'Plan Name',
      'Service Type',
      'Appointment Number',
      'Appointment Date',
      'Consumed By',
      'Notes',
    ];
    const rows = usageLog.map((row) => [
      row.consumedAt ? new Date(row.consumedAt).toLocaleString() : '',
      row.patient?.name || '',
      row.patient?.patientId || '',
      row.plan?.name || '',
      row.plan?.serviceType || '',
      row.appointment?.appointmentNumber || '',
      row.appointment?.appointmentDate || '',
      row.consumedBy?.name || row.consumedBy?.email || '',
      row.notes || '',
    ]);
    const csv = [header, ...rows].map((cols) => cols.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `package-usage-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Package Plans</h2>
          <p className={styles.pageSubtitle}>Prepaid visit bundles, assignment, and utilization tracking</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNewPlan}>+ New Plan</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          ['plans', 'Plans & Assignment'],
          ['usage', 'Usage Log'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={tab === k ? styles.btnPrimary : styles.btnSecondary}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'plans' && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            ['Assignments', analytics.summary?.totalAssignments || 0],
            ['Active', analytics.summary?.activeAssignments || 0],
            ['Completed', analytics.summary?.completedAssignments || 0],
            ['Revenue', currency(analytics.summary?.totalRevenue || 0)],
            ['Utilization', `${Number(analytics.summary?.utilizationPct || 0).toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} className={styles.card} style={{ padding: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'plans' && <div className={styles.card} style={{ marginBottom: 16 }}>
        <Table columns={planCols} data={plans} loading={loading} emptyMessage="No package plans yet" />
      </div>}

      {tab === 'plans' && <div className={styles.card} style={{ padding: 12, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0, color: '#334155' }}>Assign Package to Patient</h3>
        <form onSubmit={assignPlan} className={styles.form}>
          <div className={styles.grid3}>
            <div className={styles.field}>
              <label className={styles.label}>Patient</label>
              <SearchableSelect
                className={styles.input}
                value={patientId}
                onChange={setPatientId}
                placeholder="Search patient"
                emptyLabel="Select patient"
                options={patients.map((p) => ({ value: p.id, label: `${p.name} (${p.patientId})` }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Plan</label>
              <SearchableSelect
                className={styles.input}
                value={assignForm.packagePlanId}
                onChange={(v) => setAssignForm((f) => ({ ...f, packagePlanId: v }))}
                placeholder="Search plan"
                emptyLabel="Select plan"
                options={activePlans.map((p) => ({ value: p.id, label: `${p.name} - ${currency(p.price)}` }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Start Date</label>
              <input type="date" className={styles.input} value={assignForm.startDate} onChange={(e) => setAssignForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Notes</label>
            <input className={styles.input} value={assignForm.notes} onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={assigning}>{assigning ? 'Assigning...' : 'Assign Package'}</button>
          </div>
        </form>
      </div>}

      {tab === 'plans' && <div className={styles.card}>
        <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#334155' }}>
          {selectedPatient ? `Patient Assignments: ${selectedPatient.name}` : 'Patient Assignments'}
        </div>
        <Table columns={assignmentCols} data={assignments} loading={loading} emptyMessage="No assigned packages for selected patient" />
      </div>}

      {tab === 'plans' && appointments.length > 0 && (
        <div className={styles.card} style={{ marginTop: 12, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px', color: '#334155' }}>Recent Appointments (for optional consume tagging)</h4>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {appointments.slice(0, 8).map((a) => `${a.id} | ${a.appointmentDate} ${String(a.appointmentTime || '').slice(0, 5)} | ${a.status}`).join('\n')}
          </div>
        </div>
      )}

      {tab === 'usage' && (
        <div className={styles.card} style={{ padding: 12 }}>
          <div className={styles.filterBar} style={{ marginBottom: 10 }}>
            <input type="date" className={styles.filterSelect} value={usageFilter.from} onChange={(e) => setUsageFilter((f) => ({ ...f, from: e.target.value }))} />
            <input type="date" className={styles.filterSelect} value={usageFilter.to} onChange={(e) => setUsageFilter((f) => ({ ...f, to: e.target.value }))} />
            <SearchableSelect
              className={styles.filterSelect}
              value={usageFilter.patientId}
              onChange={(v) => setUsageFilter((f) => ({ ...f, patientId: v }))}
              placeholder="Search patient"
              emptyLabel="All Patients"
              options={patients.map((p) => ({ value: p.id, label: `${p.name} (${p.patientId})` }))}
            />
            <button className={styles.btnPrimary} onClick={() => loadUsageLog(usageFilter)}>Apply</button>
            <button
              className={styles.btnSecondary}
              onClick={() => {
                const reset = { from: '', to: '', patientId: '' };
                setUsageFilter(reset);
                setTimeout(() => loadUsageLog(reset), 0);
              }}
            >
              Reset
            </button>
            <button className={styles.btnSecondary} onClick={exportUsageCsv}>
              Export CSV
            </button>
          </div>
          {usageSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
              {[
                ['Total Usage', usageSummary.totalUsageCount || 0],
                ['Unique Patients', usageSummary.uniquePatients || 0],
                ['Unique Plans', usageSummary.uniquePlans || 0],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
          <Table columns={usageCols} data={usageLog} loading={usageLoading} emptyMessage="No package usage found" />
        </div>
      )}

      <Modal isOpen={planModal} onClose={() => setPlanModal(false)} title={editingPlan ? 'Edit Package Plan' : 'Create Package Plan'} size="lg">
        <form onSubmit={savePlan} className={styles.form}>
          <div className={styles.grid3}>
            <div className={styles.field}>
              <label className={styles.label}>Plan Name</label>
              <input className={styles.input} value={planForm.name} onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Service Type</label>
              <select className={styles.input} value={planForm.serviceType} onChange={(e) => setPlanForm((f) => ({ ...f, serviceType: e.target.value }))}>
                {['consultation', 'follow_up', 'procedure', 'custom'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Visits</label>
              <input type="number" min={1} className={styles.input} value={planForm.totalVisits} onChange={(e) => setPlanForm((f) => ({ ...f, totalVisits: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Price</label>
              <input type="number" min={0} step="0.01" className={styles.input} value={planForm.price} onChange={(e) => setPlanForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Validity (Days)</label>
              <input type="number" min={1} className={styles.input} value={planForm.validityDays} onChange={(e) => setPlanForm((f) => ({ ...f, validityDays: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Discount Type</label>
              <select className={styles.input} value={planForm.discountType} onChange={(e) => setPlanForm((f) => ({ ...f, discountType: e.target.value }))}>
                <option value="none">none</option>
                <option value="fixed">fixed</option>
                <option value="percent">percent</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Discount Value</label>
              <input type="number" min={0} step="0.01" className={styles.input} value={planForm.discountValue} onChange={(e) => setPlanForm((f) => ({ ...f, discountValue: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Status</label>
              <select className={styles.input} value={String(planForm.isActive)} onChange={(e) => setPlanForm((f) => ({ ...f, isActive: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Notes</label>
            <textarea className={styles.input} rows={2} value={planForm.notes} onChange={(e) => setPlanForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setPlanModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={planSaving}>{planSaving ? 'Saving...' : 'Save Plan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
