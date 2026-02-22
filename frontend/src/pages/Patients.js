import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientAPI, hospitalAPI, bulkAPI } from '../services/api';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Badge from '../components/Badge';
import SearchableSelect from '../components/SearchableSelect';
import PaginationControls from '../components/PaginationControls';
import { toast } from 'react-toastify';
import styles from './Page.module.css';

const INIT = {
  name: '', dateOfBirth: '', gender: 'male', bloodGroup: '', phone: '', email: '', address: '', city: '', state: '',
  emergencyContactName: '', emergencyContactPhone: '', allergies: '', medicalHistory: '', insuranceProvider: '', insuranceNumber: '',
  referralSource: '', referralDetail: '', hospitalId: '', chronicConditions: [], clinicalAlerts: [],
};
const CHRONIC_CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'COPD', 'CKD', 'Thyroid Disorder', 'Cardiac Disease', 'Epilepsy'];
const CLINICAL_ALERTS = ['High-risk Pregnancy', 'Bleeding Risk', 'Fall Risk', 'Drug Allergy Risk', 'Immunocompromised', 'Requires Isolation'];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [patientPagination, setPatientPagination] = useState(null);
  const navigate = useNavigate();

  // Bulk upload state
  const [bulkHospitalId, setBulkHospitalId] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const fileInputRef = useRef(null);

  const getDefaultHospitalId = () => hospitals?.[0]?.id || '';

  const fetchHospitals = useCallback(() => {
    hospitalAPI
      .getAll()
      .then((h) => setHospitals(h.data))
      .catch(() => setHospitals([]));
  }, []);

  const fetchPatients = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      try {
        const targetPage = overrides.page ?? page;
        const targetPerPage = overrides.perPage ?? perPage;
        const trimmedSearch = (overrides.search ?? search).trim();
        const params = {
          page: targetPage,
          per_page: targetPerPage,
        };
        if (trimmedSearch) params.search = trimmedSearch;
        const res = await patientAPI.getAll(params);
        setPatients(res.data);
        setPatientPagination(res.pagination || null);
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Unable to load patients');
      } finally {
        setLoading(false);
      }
    },
    [page, perPage, search],
  );

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(), 350);
    return () => clearTimeout(timer);
  }, [fetchPatients]);

  useEffect(() => {
    if (modal && !editing && !form.hospitalId && hospitals.length > 0) {
      setForm((prev) => ({ ...prev, hospitalId: hospitals[0].id }));
    }
  }, [modal, editing, form.hospitalId, hospitals]);

  const openCreate = () => { setEditing(null); setForm({ ...INIT, hospitalId: getDefaultHospitalId() }); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...p,
      chronicConditions: Array.isArray(p.chronicConditions) ? p.chronicConditions : [],
      clinicalAlerts: Array.isArray(p.clinicalAlerts) ? p.clinicalAlerts : [],
    });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await patientAPI.update(editing.id, form); toast.success('Patient updated'); }
      else { await patientAPI.create(form); toast.success('Patient registered'); }
      setModal(false);
      setPage(1);
      await fetchPatients({ page: 1 });
    } catch (err) { toast.error(err.response.data.message || 'Error'); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await bulkAPI.downloadPatientTemplate();
      downloadBlob(res.data, 'patients_template.xlsx');
    } catch { toast.error('Failed to download template'); }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) return toast.error('Please select a file');
    if (!bulkHospitalId) return toast.error('Please select a hospital');
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      fd.append('hospitalId', bulkHospitalId);
      const res = await bulkAPI.uploadPatients(fd);
      setBulkResult(res.data);
      if (res.data.created > 0) {
        setPage(1);
        await fetchPatients({ page: 1 });
      }
    } catch (err) {
      toast.error(err.response.data.message || 'Upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const openBulkModal = () => {
    setBulkFile(null); setBulkResult(null);
    setBulkHospitalId(hospitals[0].id || '');
    setBulkModal(true);
  };

  const set = (k, v) => setForm({ ...form, [k]: v });
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };
  const toggleListValue = (key, value) => {
    setForm((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  };
  const columns = [
    { key: 'patientId', label: 'ID', render: (v) => <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{v}</span> },
    { key: 'name', label: 'Name', render: (v, r) => <div style={{ fontWeight: 600, cursor: 'pointer', color: '#2563eb' }} onClick={() => navigate(`/patients/${r.id}`)}>{v}</div> },
    { key: 'gender', label: 'Gender', render: (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : '-'},
    { key: 'bloodGroup', label: 'Blood', render: (v) => v ? <Badge text={v} type="default" /> : '-'},
    { key: 'phone', label: 'Phone' },
    { key: 'clinicalAlerts', label: 'Alerts', render: (v) => Array.isArray(v) && v.length ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>{v.length}</span> : '-' },
    { key: 'referralSource', label: 'Referral', render: (v) => v || '-' },
    { key: 'hospital', label: 'Hospital', render: (v) => v.name || '-' },
    { key: 'id', label: 'Actions', render: (_, r) => (
      <div className={styles.actions}>
        <button className={styles.btnEdit} onClick={() => navigate(`/patients/${r.id}`)}>View</button>
        <button className={styles.btnSuccess} onClick={() => openEdit(r)}>Edit</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2 className={styles.pageTitle}>Patients</h2><p className={styles.pageSubtitle}>{patientPagination?.total ?? patients.length} patients registered</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={openBulkModal}>⬆ Bulk Upload</button>
          <button className={styles.btnPrimary} onClick={openCreate}>+ Register Patient</button>
        </div>
      </div>
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search by name, ID, or phone..." value={search} onChange={(e) => handleSearchChange(e.target.value)} />
      </div>
      <div className={styles.card}>
        <Table columns={columns} data={patients} loading={loading} />
        <PaginationControls
          meta={patientPagination}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPerPageChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Patient' : 'Register Patient'} size="xl">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Full Name *</label><input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Date of Birth</label><input className={styles.input} type="date" value={form.dateOfBirth || ''} onChange={(e) => set('dateOfBirth', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Gender</label>
              <select className={styles.input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Blood Group</label>
              <select className={styles.input} value={form.bloodGroup || ''} onChange={(e) => set('bloodGroup', e.target.value)}>
                <option value="">Select</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className={styles.field}><label className={styles.label}>Phone *</label><input className={styles.input} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} required /></div>
            <div className={styles.field}><label className={styles.label}>Email</label><input className={styles.input} type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Hospital *</label>
              <SearchableSelect
                className={styles.input}
                value={form.hospitalId || ''}
                onChange={(v) => set('hospitalId', v)}
                placeholder="Search hospital"
                emptyLabel="Select Hospital"
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
              />
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Address</label><input className={styles.input} value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>City</label><input className={styles.input} value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>State</label><input className={styles.input} value={form.state || ''} onChange={(e) => set('state', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Emergency Contact</label><input className={styles.input} value={form.emergencyContactName || ''} onChange={(e) => set('emergencyContactName', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Emergency Phone</label><input className={styles.input} value={form.emergencyContactPhone || ''} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Insurance Provider</label><input className={styles.input} value={form.insuranceProvider || ''} onChange={(e) => set('insuranceProvider', e.target.value)} /></div>
            <div className={styles.field}><label className={styles.label}>Insurance Number</label><input className={styles.input} value={form.insuranceNumber || ''} onChange={(e) => set('insuranceNumber', e.target.value)} /></div>
            <div className={styles.field}>
              <label className={styles.label}>Referral Source</label>
              <select className={styles.input} value={form.referralSource || ''} onChange={(e) => set('referralSource', e.target.value)}>
                <option value="">Select</option>
                {['Walk-in', 'Google', 'Website', 'Doctor Referral', 'Friend/Family', 'Insurance', 'Corporate', 'Camp', 'Social Media', 'Other'].map((src) => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Referral Detail</label>
              <input className={styles.input} value={form.referralDetail || ''} onChange={(e) => set('referralDetail', e.target.value)} placeholder="Doctor name / campaign / notes" />
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Allergies</label><textarea className={styles.input} rows={2} value={form.allergies || ''} onChange={(e) => set('allergies', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}><label className={styles.label}>Medical History</label><textarea className={styles.input} rows={3} value={form.medicalHistory || ''} onChange={(e) => set('medicalHistory', e.target.value)} /></div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Chronic Conditions</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CHRONIC_CONDITIONS.map((condition) => {
                  const active = (form.chronicConditions || []).includes(condition);
                  return (
                    <button
                      key={condition}
                      type="button"
                      onClick={() => toggleListValue('chronicConditions', condition)}
                      style={{
                        border: `1px solid ${active ? '#1d4ed8' : '#cbd5e1'}`,
                        color: active ? '#1d4ed8' : '#475569',
                        background: active ? '#dbeafe' : '#fff',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '4px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      {condition}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.field} style={{ gridColumn: 'span 2' }}>
              <label className={styles.label}>Clinical Alerts</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CLINICAL_ALERTS.map((alert) => {
                  const active = (form.clinicalAlerts || []).includes(alert);
                  return (
                    <button
                      key={alert}
                      type="button"
                      onClick={() => toggleListValue('clinicalAlerts', alert)}
                      style={{
                        border: `1px solid ${active ? '#b91c1c' : '#cbd5e1'}`,
                        color: active ? '#b91c1c' : '#475569',
                        background: active ? '#fee2e2' : '#fff',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '4px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      {alert}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>{editing ? 'Update' : 'Register'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal isOpen={bulkModal} onClose={() => { setBulkModal(false); setBulkResult(null); }} title="Bulk Upload Patients" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Step 1: Download template */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>Step 1 - Download Template</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
              Download the Excel template, fill in your patient data, and then upload it below.
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
            <div style={{ fontWeight: 600, color: '#1e40af' }}>Step 2 - Upload Filled Template</div>

            <div className={styles.field}>
              <label className={styles.label}>Hospital *</label>
              <SearchableSelect
                className={styles.input}
                value={bulkHospitalId}
                onChange={setBulkHospitalId}
                placeholder="Search hospital"
                emptyLabel="Select Hospital"
                options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
              />
            </div>

            <div
              onClick={() => fileInputRef.current.click()}
              style={{
                border: '2px dashed #93c5fd', borderRadius: 10, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', background:bulkFile ? '#f0fdf4' : '#f8fafc',
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
                    {(bulkFile.size / 1024).toFixed(1)} KB - Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                  <div style={{ fontWeight: 600, color: '#374151' }}>Click to select Excel file</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>.xlsx or .xls - max 5 MB</div>
                </div>
              )}
            </div>

            {/* Result summary */}
            {bulkResult && (
              <div style={{ borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  background:bulkResult.errors.length === 0 ? '#dcfce7' : '#fef3c7',
                  padding: '12px 16px', fontWeight: 600,
                  color:bulkResult.errors.length === 0 ? '#15803d' : '#92400e',
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
              <button type="submit" className={styles.btnPrimary} disabled={!bulkFile || !bulkHospitalId || bulkUploading}>
                {bulkUploading ? 'Uploading...' : '⬆ Upload & Import'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
