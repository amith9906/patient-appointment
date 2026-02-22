import React, { useState, useEffect, useCallback } from 'react';
import { labAPI, patientAPI, hospitalAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const TEST_STATUSES = ['ordered', 'sample_collected', 'processing', 'completed', 'cancelled'];
const LAB_INIT = { name: '', description: '', phone: '', email: '', floor: '', operatingHours: '', hospitalId: '' };
const TEST_INIT = { testName: '', testCode: '', category: '', price: 0, normalRange: '', unit: '', turnaroundTime: '', labId: '', patientId: '', appointmentId: '' };

export default function Labs() {
  const [labs, setLabs] = useState([]);
  const [tests, setTests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labModal, setLabModal] = useState(false);
  const [testModal, setTestModal] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [editingLab, setEditingLab] = useState(null);
  const [editingTest, setEditingTest] = useState(null);
  const [labForm, setLabForm] = useState(LAB_INIT);
  const [testForm, setTestForm] = useState(TEST_INIT);
  const [resultForm, setResultForm] = useState({ result: '', resultValue: '', isAbnormal: false, status: 'completed', technicianNotes: '' });
  const [tab, setTab] = useState('tests');
  const [statusFilter, setStatusFilter] = useState('');
  const [testPage, setTestPage] = useState(1);
  const [testPerPage, setTestPerPage] = useState(25);
  const [testPagination, setTestPagination] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      page: testPage,
      per_page: testPerPage,
    };
    if (statusFilter) params.status = statusFilter;
    Promise.all([labAPI.getAll(), labAPI.getAllTests(params), patientAPI.getAll({ paginate: 'false' }), hospitalAPI.getAll()])
      .then(([l, t, p, h]) => {
        setLabs(l.data);
        setTests(t.data);
        setTestPagination(t.pagination || null);
        setPatients(p.data);
        setHospitals(h.data);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, testPage, testPerPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTestPage(1);
  }, [statusFilter]);

  const handleLabSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLab) { await labAPI.update(editingLab.id, labForm); toast.success('Lab updated'); }
      else { await labAPI.create(labForm); toast.success('Lab created'); }
      setLabModal(false); load();
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTest) { await labAPI.updateTest(editingTest.id, testForm); toast.success('Test updated'); }
      else { await labAPI.createTest(testForm); toast.success('Test ordered'); }
      setTestModal(false); load();
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const handleResultSubmit = async (e) => {
    e.preventDefault();
    try {
      await labAPI.updateTest(resultModal.id, { ...resultForm, completedDate: new Date() });
      toast.success('Results saved');
      setResultModal(null); load();
    } catch (err) { toast.error('Error'); }
  };

  const testCols = [
    { key: 'testNumber', label: 'Test #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { key: 'testName', label: 'Test Name', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.category}</div></div> },
    { key: 'patient', label: 'Patient', render: (v) => v.name || '-' },
    { key: 'lab', label: 'Lab', render: (v) => v.name || '-' },
    { key: 'price', label: 'Price', render: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
    { key: 'status', label: 'Status', render: (v) => <Badge text={v} type={v} /> },
    { key: 'isAbnormal', label: 'Result', render: (v, r) => r.status === 'completed' ? <Badge text={v ? 'Abnormal' : 'Normal'} type={v ? 'cancelled' : 'completed'} /> : '-' },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        {r.status !== 'completed' && r.status !== 'cancelled' && (
          <>
            {r.status === 'ordered' && <button className={styles.btnWarning} onClick={() => labAPI.updateTest(r.id, { status: 'sample_collected' }).then(() => { toast.success('Sample collected'); load(); })}>Collect</button>}
            {r.status === 'sample_collected' && <button className={styles.btnWarning} onClick={() => labAPI.updateTest(r.id, { status: 'processing' }).then(() => { toast.success('Processing started'); load(); })}>Process</button>}
            {r.status === 'processing' && <button className={styles.btnSuccess} onClick={() => { setResultModal(r); setResultForm({ result: '', resultValue: '', isAbnormal: false, status: 'completed', technicianNotes: '' }); }}>Enter Results</button>}
          </>
        )}
        {r.status === 'completed' && <button className={styles.btnEdit} onClick={() => { setResultModal(r); setResultForm({ result: r.result || '', resultValue: r.resultValue || '', isAbnormal: r.isAbnormal, status: 'completed', technicianNotes: r.technicianNotes || '' }); }}>View</button>}
      </div>
    )},
  ];

  const labCols = [
    { key: 'name', label: 'Name', render: (v) => <div style={{ fontWeight: 600 }}>{v}</div> },
    { key: 'hospital', label: 'Hospital', render: (v) => v.name || '-' },
    { key: 'floor', label: 'Floor' },
    { key: 'phone', label: 'Phone' },
    { key: 'operatingHours', label: 'Hours' },
    { key: 'isActive', label: 'Status', render: (v) => <Badge text={v ? 'Active' : 'Inactive'} type={v ? 'active' : 'inactive'} /> },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => { setEditingLab(r); setLabForm({ ...r }); setLabModal(true); }}>Edit</button>
        <button className={styles.btnDelete} onClick={() => labAPI.delete(r.id).then(() => { toast.success('Lab deactivated'); load(); })}>Deactivate</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Labs & Tests</h2><p className={styles.pageSubtitle}>{labs.length} labs  |  {tests.length} tests</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => { setEditingLab(null); setLabForm(LAB_INIT); setLabModal(true); }}>+ Add Lab</button>
          <button className={styles.btnPrimary} onClick={() => { setEditingTest(null); setTestForm(TEST_INIT); setTestModal(true); }}>+ Order Test</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['tests', 'labs'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', border: 'none', borderBottom:tab === t ? '3px solid #2563eb' : '3px solid transparent', background: 'none', fontWeight: 600, fontSize: 14, color:tab === t ? '#2563eb' : '#64748b', cursor: 'pointer' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'tests' && (
        <>
          <div className={styles.filterBar}>
            <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {TEST_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <button className={styles.btnSecondary} onClick={() => setStatusFilter('')}>Clear</button>
          </div>
          <div className={styles.card}>
            <Table columns={testCols} data={tests} loading={loading} />
            <PaginationControls
              meta={testPagination}
              onPageChange={(nextPage) => setTestPage(nextPage)}
              onPerPageChange={(value) => {
                setTestPerPage(value);
                setTestPage(1);
              }}
            />
          </div>
        </>
      )}
      {tab === 'labs' && <div className={styles.card}><Table columns={labCols} data={labs} loading={loading} /></div>}

      {/* Lab Modal */}
      <Modal isOpen={labModal} onClose={() => setLabModal(false)} title={editingLab ? 'Edit Lab' : 'Add Lab'}>
        <form onSubmit={handleLabSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Lab Name *</label><input className={styles.input} value={labForm.name} onChange={(e) => setLabForm({ ...labForm, name: e.target.value })} required /></div>
            <div className={styles.field}><label className={styles.label}>Phone</label><input className={styles.input} value={labForm.phone || ''} onChange={(e) => setLabForm({ ...labForm, phone: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Email</label><input className={styles.input} value={labForm.email || ''} onChange={(e) => setLabForm({ ...labForm, email: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Floor</label><input className={styles.input} value={labForm.floor || ''} onChange={(e) => setLabForm({ ...labForm, floor: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Operating Hours</label><input className={styles.input} value={labForm.operatingHours || ''} onChange={(e) => setLabForm({ ...labForm, operatingHours: e.target.value })} placeholder="e.g. 8AM - 8PM" /></div>
            <div className={styles.field}><label className={styles.label}>Hospital</label>
              <SearchableSelect
                className={styles.input}
                value={labForm.hospitalId || ''}
                onChange={(value) => setLabForm({ ...labForm, hospitalId: value })}
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
                placeholder="Search hospital..."
                emptyLabel="Select Hospital"
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setLabModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editingLab ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Order Test Modal */}
      <Modal isOpen={testModal} onClose={() => setTestModal(false)} title="Order Lab Test">
        <form onSubmit={handleTestSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Test Name *</label><input className={styles.input} value={testForm.testName} onChange={(e) => setTestForm({ ...testForm, testName: e.target.value })} required /></div>
            <div className={styles.field}><label className={styles.label}>Test Code</label><input className={styles.input} value={testForm.testCode || ''} onChange={(e) => setTestForm({ ...testForm, testCode: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Category</label><input className={styles.input} value={testForm.category || ''} onChange={(e) => setTestForm({ ...testForm, category: e.target.value })} placeholder="Blood, Urine, Imaging..." /></div>
            <div className={styles.field}><label className={styles.label}>Price ($)</label><input type="number" step="0.01" className={styles.input} value={testForm.price} onChange={(e) => setTestForm({ ...testForm, price: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Normal Range</label><input className={styles.input} value={testForm.normalRange || ''} onChange={(e) => setTestForm({ ...testForm, normalRange: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Unit</label><input className={styles.input} value={testForm.unit || ''} onChange={(e) => setTestForm({ ...testForm, unit: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Turnaround Time</label><input className={styles.input} value={testForm.turnaroundTime || ''} onChange={(e) => setTestForm({ ...testForm, turnaroundTime: e.target.value })} placeholder="e.g. 2 hours" /></div>
            <div className={styles.field}><label className={styles.label}>Patient *</label>
              <SearchableSelect
                className={styles.input}
                value={testForm.patientId}
                onChange={(value) => setTestForm({ ...testForm, patientId: value })}
                options={patients.map((p) => ({ value: p.id, label: `${p.name} (${p.patientId})` }))}
                placeholder="Search patient..."
                emptyLabel="Select Patient"
                required
              />
            </div>
            <div className={styles.field}><label className={styles.label}>Lab *</label>
              <SearchableSelect
                className={styles.input}
                value={testForm.labId}
                onChange={(value) => setTestForm({ ...testForm, labId: value })}
                options={labs.map((l) => ({ value: l.id, label: l.name }))}
                placeholder="Search lab..."
                emptyLabel="Select Lab"
                required
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setTestModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Order Test</button>
          </div>
        </form>
      </Modal>

      {/* Result Modal */}
      <Modal isOpen={!!resultModal} onClose={() => setResultModal(null)} title={`Results - ${resultModal?.testName || ''}`}>
        <form onSubmit={handleResultSubmit} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {resultModal?.normalRange && <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>Normal Range: <strong>{resultModal.normalRange} {resultModal.unit}</strong></div>}
            <div className={styles.field}><label className={styles.label}>Result Value</label><input className={styles.input} value={resultForm.resultValue} onChange={(e) => setResultForm({ ...resultForm, resultValue: e.target.value })} placeholder="e.g. 7.4, 120/80" /></div>
            <div className={styles.field}><label className={styles.label}>Full Result</label><textarea className={styles.input} rows={3} value={resultForm.result} onChange={(e) => setResultForm({ ...resultForm, result: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Is Abnormal</label>
              <select className={styles.input} value={resultForm.isAbnormal ? 'true' : 'false'} onChange={(e) => setResultForm({ ...resultForm, isAbnormal: e.target.value === 'true' })}>
                <option value="false">Normal</option><option value="true">Abnormal</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Technician Notes</label><textarea className={styles.input} rows={2} value={resultForm.technicianNotes} onChange={(e) => setResultForm({ ...resultForm, technicianNotes: e.target.value })} /></div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setResultModal(null)}>Close</button>
            {resultModal?.status !== 'completed' && <button type="submit" className={styles.btnPrimary}>Save Results</button>}
          </div>
        </form>
      </Modal>
    </div>
  );
}
