import React, { useState, useEffect, useCallback, useRef } from 'react';
import { labAPI, patientAPI, hospitalAPI, labReportTemplateAPI, pdfAPI } from '../services/api';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import { toast } from 'react-toastify';
import styles from './Page.module.css';
import useDebouncedFilters from '../hooks/useDebouncedFilters';

const TEST_STATUSES = ['ordered', 'sample_collected', 'processing', 'completed', 'cancelled'];
const LAB_INIT = { name: '', description: '', phone: '', email: '', floor: '', operatingHours: '', hospitalId: '' };
const TEST_INIT = { testName: '', testCode: '', category: '', price: 0, normalRange: '', unit: '', turnaroundTime: '', labId: '', patientId: '', appointmentId: '', templateId: '' };

const isOutOfRange = (value, field) => {
  if (field.type !== 'number') return false;
  const v = parseFloat(value);
  if (isNaN(v)) return false;
  if (field.normalMin !== '' && field.normalMin !== undefined && v < Number(field.normalMin)) return true;
  if (field.normalMax !== '' && field.normalMax !== undefined && v > Number(field.normalMax)) return true;
  return false;
};

const INITIAL_FILTERS = {
  status: '',
  patientId: '',
  labId: '',
  category: '',
  fromDate: '',
  toDate: '',
  search: '',
  isAbnormal: '',
};

export default function Labs() {
  const [labs, setLabs] = useState([]);
  const [tests, setTests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [labModal, setLabModal] = useState(false);
  const [testModal, setTestModal] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [editingLab, setEditingLab] = useState(null);
  const [editingTest, setEditingTest] = useState(null);

  const [labForm, setLabForm] = useState(LAB_INIT);
  const [testForm, setTestForm] = useState(TEST_INIT);
  const [resultForm, setResultForm] = useState({ result: '', resultValue: '', isAbnormal: false, status: 'completed', technicianNotes: '' });

  // Template result entry state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateValues, setTemplateValues] = useState({});
  const [abnormalFields, setAbnormalFields] = useState([]);

  const [tab, setTab] = useState('tests');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [testPage, setTestPage] = useState(1);
  const [testPerPage, setTestPerPage] = useState(25);
  const [testPagination, setTestPagination] = useState(null);

  const testPageRef = useRef(testPage);
  const testPerPageRef = useRef(testPerPage);
  useEffect(() => { testPageRef.current = testPage; }, [testPage]);
  useEffect(() => { testPerPageRef.current = testPerPage; }, [testPerPage]);

  const { filtersRef, debouncedFilters } = useDebouncedFilters(filters, 400);

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      page: testPageRef.current,
      per_page: testPerPageRef.current,
    };
    const activeFilters = filtersRef.current;
    if (activeFilters?.status) params.status = activeFilters.status;
    if (activeFilters?.patientId) params.patientId = activeFilters.patientId;
    if (activeFilters?.labId) params.labId = activeFilters.labId;
    if (activeFilters?.category) params.category = activeFilters.category;
    if (activeFilters?.fromDate) params.fromDate = activeFilters.fromDate;
    if (activeFilters?.toDate) params.toDate = activeFilters.toDate;
    if (activeFilters?.search) params.search = activeFilters.search;
    if (activeFilters?.isAbnormal) params.isAbnormal = activeFilters.isAbnormal;

    Promise.all([
      labAPI.getAll(),
      labAPI.getAllTests(params),
      patientAPI.getAll({ paginate: 'false' }),
      hospitalAPI.getAll(),
      labReportTemplateAPI.getAll().catch(() => ({ data: [] })),
    ])
      .then(([l, t, p, h, tpls]) => {
        setLabs(l.data || []);
        setTests(t.data || []);
        setTestPagination(t.pagination || null);
        setPatients(p.data || []);
        setHospitals(h.data || []);
        setTemplates(tpls.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Reload when page/perPage changes
  useEffect(() => {
    load();
  }, [load, testPage, testPerPage]);

  // When debounced filters change: reset to page 1 and reload
  useEffect(() => {
    setTestPage(1);
    testPageRef.current = 1;
    load();
  }, [
    debouncedFilters.status,
    debouncedFilters.patientId,
    debouncedFilters.labId,
    debouncedFilters.category,
    debouncedFilters.fromDate,
    debouncedFilters.toDate,
    debouncedFilters.search,
    debouncedFilters.isAbnormal,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLabSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLab) { await labAPI.update(editingLab.id, labForm); toast.success('Lab updated'); }
      else { await labAPI.create(labForm); toast.success('Lab created'); }
      setLabModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTest) { await labAPI.updateTest(editingTest.id, testForm); toast.success('Test updated'); }
      else { await labAPI.createTest(testForm); toast.success('Test ordered'); }
      setTestModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const openResultModal = (test) => {
    setResultModal(test);
    setResultForm({
      result: test.result || '',
      resultValue: test.resultValue || '',
      isAbnormal: !!test.isAbnormal,
      status: 'completed',
      technicianNotes: test.technicianNotes || '',
    });

    const preId = test.templateId || (test.template ? test.template.id : '');
    const autoId = preId || (templates.length > 0 ? templates[0].id : '');
    setSelectedTemplateId(autoId);
    setTemplateValues(test.templateValues || {});
    setAbnormalFields(test.abnormalFields || []);
  };

  const handleTemplateValueChange = (field, value) => {
    setTemplateValues((prev) => ({ ...prev, [field.key]: value }));
    if (isOutOfRange(value, field)) {
      setAbnormalFields((prev) => (prev.includes(field.key) ? prev : [...prev, field.key]));
    } else {
      setAbnormalFields((prev) => prev.filter((k) => k !== field.key));
    }
  };

  const toggleAbnormal = (key) => {
    setAbnormalFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const handleResultSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...resultForm,
        completedDate: new Date(),
      };

      if (selectedTemplate) {
        payload.templateId = selectedTemplate.id;
        payload.templateValues = templateValues;
        payload.abnormalFields = abnormalFields;
        payload.isAbnormal = abnormalFields.length > 0;
        const summary = (selectedTemplate.fields || [])
          .map((f) => `${f.label}: ${templateValues[f.key] || '—'}${f.unit ? ' ' + f.unit : ''}`)
          .join(' | ');
        payload.result = summary;
      }

      await labAPI.updateTest(resultModal.id, payload);
      toast.success('Results saved successfully');
      setResultModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving results');
    }
  };

  const downloadReport = async (test) => {
    try {
      const res = await pdfAPI.labReport(test.id);
      downloadBlob(res.data, `lab-report-${test.testNumber || test.id}.pdf`);
    } catch {
      toast.error('Failed to download report PDF');
    }
  };

  const downloadReceipt = async (test) => {
    try {
      const res = await pdfAPI.labReceipt(test.id);
      downloadBlob(res.data, `lab-receipt-${test.testNumber || test.id}.pdf`);
    } catch {
      toast.error('Failed to download receipt PDF');
    }
  };

  const testCols = [
    { key: 'testNumber', label: 'Test #', render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { key: 'testName', label: 'Test Name', render: (v, r) => <div><div style={{ fontWeight: 600 }}>{v}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.category || r.template?.name}</div></div> },
    { key: 'patient', label: 'Patient', render: (v) => v?.name || '-' },
    { key: 'lab', label: 'Lab', render: (v) => v?.name || '-' },
    { key: 'price', label: 'Price', render: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
    { key: 'status', label: 'Status', render: (v) => <Badge text={v} type={v} /> },
    { key: 'isAbnormal', label: 'Result', render: (v, r) => r.status === 'completed' ? <Badge text={v ? 'Abnormal' : 'Normal'} type={v ? 'cancelled' : 'completed'} /> : '-' },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {r.status !== 'completed' && r.status !== 'cancelled' && (
          <>
            {r.status === 'ordered' && <button className={styles.btnWarning} onClick={() => labAPI.updateTest(r.id, { status: 'sample_collected' }).then(() => { toast.success('Sample collected'); load(); })}>Collect</button>}
            {r.status === 'sample_collected' && <button className={styles.btnWarning} onClick={() => labAPI.updateTest(r.id, { status: 'processing' }).then(() => { toast.success('Processing started'); load(); })}>Process</button>}
            {r.status === 'processing' && <button className={styles.btnSuccess} onClick={() => openResultModal(r)}>Enter Results</button>}
          </>
        )}
        {r.status === 'completed' && (
          <>
            <button className={styles.btnEdit} onClick={() => openResultModal(r)}>View / Update</button>
            <button type="button" className={styles.btnSuccess} onClick={() => downloadReport(r)} title="Download Diagnostic Report PDF">
              📄 Report
            </button>
          </>
        )}
        <button type="button" className={styles.btnSecondary} onClick={() => downloadReceipt(r)} title="Download Lab Test Billing Receipt PDF">
          🧾 Receipt
        </button>
      </div>
    )},
  ];

  const labCols = [
    { key: 'name', label: 'Name', render: (v) => <div style={{ fontWeight: 600 }}>{v}</div> },
    { key: 'hospital', label: 'Hospital', render: (v) => v?.name || '-' },
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
            style={{ padding: '8px 20px', border: 'none', borderBottom: tab === t ? '3px solid #2563eb' : '3px solid transparent', background: 'none', fontWeight: 600, fontSize: 14, color: tab === t ? '#2563eb' : '#64748b', cursor: 'pointer' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'tests' && (
        <>
          <div className={styles.filterBar} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search Test #, Name, Code..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              style={{ minWidth: 200, flex: '1 1 200px' }}
            />
            <select
              className={styles.filterSelect}
              value={filters.patientId}
              onChange={(e) => setFilters((prev) => ({ ...prev, patientId: e.target.value }))}
            >
              <option value="">All Patients</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.patientId ? `(${p.patientId})` : ''}
                </option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={filters.labId}
              onChange={(e) => setFilters((prev) => ({ ...prev, labId: e.target.value }))}
            >
              <option value="">All Labs</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              {TEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All Categories</option>
              <option value="Biochemistry">Biochemistry</option>
              <option value="Hematology">Hematology</option>
              <option value="Microbiology">Microbiology</option>
              <option value="Pathology">Pathology</option>
              <option value="Radiology">Radiology</option>
              <option value="Immunology">Immunology</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filters.isAbnormal}
              onChange={(e) => setFilters((prev) => ({ ...prev, isAbnormal: e.target.value }))}
            >
              <option value="">All Results</option>
              <option value="false">Normal</option>
              <option value="true">Abnormal</option>
            </select>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>From:</span>
              <input
                type="date"
                className={styles.filterSelect}
                value={filters.fromDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                style={{ padding: '7px 10px' }}
              />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>To:</span>
              <input
                type="date"
                className={styles.filterSelect}
                value={filters.toDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                style={{ padding: '7px 10px' }}
              />
            </div>

            <button className={styles.btnSecondary} onClick={() => setFilters(INITIAL_FILTERS)}>
              Clear
            </button>
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
            {/* Template Selector */}
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label} style={{ color: '#1d4ed8', fontWeight: 700 }}>
                🧪 Lab Report Template (Optional)
              </label>
              <select
                className={styles.input}
                value={testForm.templateId || ''}
                onChange={(e) => {
                  const tplId = e.target.value;
                  const tpl = templates.find((t) => t.id === tplId);
                  setTestForm((prev) => ({
                    ...prev,
                    templateId: tplId,
                    testName: tpl ? tpl.name : prev.testName,
                    category: tpl ? tpl.category || prev.category : prev.category,
                  }));
                }}
              >
                <option value="">-- Select Report Template (e.g. CBC, LFT, KFT, Master Profile) --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    🧪 {t.name} ({t.category || 'General'}) — {(t.fields || []).length} parameters
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                Selecting a template auto-loads its parameters when entering patient test values.
              </div>
            </div>

            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Test Name *</label><input className={styles.input} value={testForm.testName} onChange={(e) => setTestForm({ ...testForm, testName: e.target.value })} required placeholder="e.g. Complete Blood Count (CBC)" /></div>
            <div className={styles.field}><label className={styles.label}>Test Code</label><input className={styles.input} value={testForm.testCode || ''} onChange={(e) => setTestForm({ ...testForm, testCode: e.target.value })} /></div>
            <div className={styles.field}><label className={styles.label}>Category</label><input className={styles.input} value={testForm.category || ''} onChange={(e) => setTestForm({ ...testForm, category: e.target.value })} placeholder="Blood, Urine, Biochemistry..." /></div>
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
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Lab *</label>
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

      {/* Result Entry & Template Parameters Modal (Extra Large Size for Easy Typing) */}
      <Modal isOpen={!!resultModal} onClose={() => setResultModal(null)} title={`Enter Results — ${resultModal?.testName || ''}`} size="xl">
        <form onSubmit={handleResultSubmit} className={styles.form}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {/* Template Selector in Result Modal */}
            <div>
              <label className={styles.label} style={{ color: '#1d4ed8', fontWeight: 700, marginBottom: 4, display: 'block' }}>
                🧪 Report Template Parameters
              </label>
              <select
                className={styles.input}
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  setTemplateValues({});
                  setAbnormalFields([]);
                }}
              >
                <option value="">-- No Template (Enter Manual Text Result) --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    🧪 {t.name} ({t.category || 'General'}) — {(t.fields || []).length} parameters
                  </option>
                ))}
              </select>
            </div>

            {/* Structured Template Parameters Table */}
            {selectedTemplate ? (
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                <div style={{ background: '#2563eb', padding: '12px 18px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedTemplate.name}</span>
                    <span style={{ fontSize: 13, opacity: 0.9, marginLeft: 10 }}>({selectedTemplate.category})</span>
                  </div>
                  <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.25)', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
                    {(selectedTemplate.fields || []).length} parameters
                  </span>
                </div>

                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px 90px 90px', background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <div>Parameter & Ref Range</div>
                  <div>Value Input</div>
                  <div style={{ textAlign: 'center' }}>Unit</div>
                  <div style={{ textAlign: 'center' }}>Flag</div>
                </div>

                {/* Parameters List */}
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {(selectedTemplate.fields || []).map((field, idx) => {
                    const val = templateValues[field.key] || '';
                    const isAbn = abnormalFields.includes(field.key);
                    return (
                      <div
                        key={field.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 240px 90px 90px',
                          alignItems: 'center',
                          padding: '10px 16px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isAbn ? '#fef2f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isAbn ? '#b91c1c' : '#1e293b' }}>
                            {field.label}
                          </div>
                          {(field.normalRange || field.normalMin !== '' || field.normalMax !== '') && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              Ref: {field.normalRange || `${field.normalMin}–${field.normalMax}`}{field.unit ? ` ${field.unit}` : ''}
                            </div>
                          )}
                        </div>
                        <div>
                          {field.type === 'select' ? (
                            <select
                              value={val}
                              onChange={(e) => handleTemplateValueChange(field, e.target.value)}
                              style={{
                                width: '100%',
                                border: isAbn ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '5px 8px',
                                fontSize: 13,
                                background: isAbn ? '#fff1f2' : '#fff',
                              }}
                            >
                              <option value="">-- Select --</option>
                              {(field.options || '').split(',').filter(Boolean).map((opt) => (
                                <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              step="any"
                              value={val}
                              onChange={(e) => handleTemplateValueChange(field, e.target.value)}
                              placeholder="Enter value"
                              style={{
                                width: '100%',
                                border: isAbn ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '5px 8px',
                                fontSize: 13,
                                background: isAbn ? '#fff1f2' : '#fff',
                              }}
                            />
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>{field.unit || ''}</div>
                        <div style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggleAbnormal(field.key)}
                            style={{
                              background: isAbn ? '#fee2e2' : '#f1f5f9',
                              border: isAbn ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                              color: isAbn ? '#dc2626' : '#64748b',
                              borderRadius: 4,
                              padding: '3px 6px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            {isAbn ? 'HIGH/LOW' : 'OK'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {resultModal?.normalRange && (
                  <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#166534' }}>
                    Reference Range: <strong>{resultModal.normalRange} {resultModal.unit}</strong>
                  </div>
                )}
                <div className={styles.field}>
                  <label className={styles.label}>Result Value</label>
                  <input className={styles.input} value={resultForm.resultValue} onChange={(e) => setResultForm({ ...resultForm, resultValue: e.target.value })} placeholder="e.g. 7.4, 120/80" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Full Result Description</label>
                  <textarea className={styles.input} rows={3} value={resultForm.result} onChange={(e) => setResultForm({ ...resultForm, result: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Is Abnormal</label>
                  <select className={styles.input} value={resultForm.isAbnormal ? 'true' : 'false'} onChange={(e) => setResultForm({ ...resultForm, isAbnormal: e.target.value === 'true' })}>
                    <option value="false">Normal</option>
                    <option value="true">Abnormal</option>
                  </select>
                </div>
              </>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Technician Notes</label>
              <textarea className={styles.input} rows={2} value={resultForm.technicianNotes} onChange={(e) => setResultForm({ ...resultForm, technicianNotes: e.target.value })} placeholder="Additional lab observations or comments..." />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setResultModal(null)}>Close</button>
            <button type="submit" className={styles.btnPrimary}>Save & Publish Results</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
